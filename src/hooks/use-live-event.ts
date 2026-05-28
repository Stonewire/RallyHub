import { useCallback, useEffect, useRef, useState } from 'react'

import type { LiveEventBundle } from '@/lib/live-event'
import { resetLiveEvent } from '@/lib/reset-live-event'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesUpdate } from '@/types/helpers'

const RELOAD_DEBOUNCE_MS = 280

async function fetchBundle(eventId: string): Promise<LiveEventBundle | null> {
  const { data: event, error: eErr } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle()

  if (eErr) throw eErr
  if (!event) return null

  const [orgRes, stateRes, teamsRes, egRes] = await Promise.all([
    supabase
      .from('organization_tenant_public')
      .select('*')
      .eq('id', event.organization_id)
      .maybeSingle(),
    supabase.from('event_state').select('*').eq('event_id', eventId).maybeSingle(),
    supabase.from('teams').select('*').eq('event_id', eventId).order('slot_number'),
    supabase.from('event_games').select('game_id').eq('event_id', eventId),
  ])

  if (stateRes.error) throw stateRes.error
  if (teamsRes.error) throw teamsRes.error
  if (egRes.error) throw egRes.error

  let state = stateRes.data
  if (!state) {
    const { data: created, error } = await supabase
      .from('event_state')
      .insert({ event_id: eventId })
      .select()
      .single()
    if (error) throw error
    state = created
  }

  const gameIds = (egRes.data ?? []).map((r) => r.game_id)
  let games: Tables<'games'>[] = []
  if (gameIds.length > 0) {
    const { data, error } = await supabase.from('games').select('*').in('id', gameIds)
    if (error) throw error
    games = data ?? []
  }

  const { data: submissions, error: subErr } = await supabase
    .from('submissions')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (subErr) throw subErr

  return {
    event,
    organization: orgRes.data ?? null,
    state,
    teams: teamsRes.data ?? [],
    games,
    submissions: submissions ?? [],
  }
}

type SubmissionPayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Tables<'submissions'> | null
  old: Tables<'submissions'> | null
}

function mergeSubmission(
  subs: Tables<'submissions'>[],
  payload: SubmissionPayload,
): Tables<'submissions'>[] {
  const { eventType, new: row, old } = payload
  if (eventType === 'DELETE' && old) {
    return subs.filter((s) => s.id !== old.id)
  }
  if (!row) return subs
  const idx = subs.findIndex((s) => s.id === row.id)
  if (eventType === 'INSERT') {
    if (idx >= 0) {
      const next = [...subs]
      next[idx] = row
      return next
    }
    return [row, ...subs]
  }
  if (idx >= 0) {
    const next = [...subs]
    next[idx] = row
    return next
  }
  return [row, ...subs]
}

export function useLiveEvent(eventId: string | undefined) {
  const [bundle, setBundle] = useState<LiveEventBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [channelCycle, setChannelCycle] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bundleRef = useRef(bundle)
  bundleRef.current = bundle

  const reload = useCallback(async () => {
    if (!eventId) return
    try {
      const data = await fetchBundle(eventId)
      setBundle(data)
      setError(data ? null : 'Event not found')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  const scheduleReload = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      void reload()
    }, RELOAD_DEBOUNCE_MS)
  }, [reload])

  const reloadRef = useRef(reload)
  reloadRef.current = reload
  const scheduleReloadRef = useRef(scheduleReload)
  scheduleReloadRef.current = scheduleReload

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!eventId) return

    const channel = supabase
      .channel(`live:event:${eventId}:bundle`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `id=eq.${eventId}` },
        () => scheduleReloadRef.current(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_state', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const row = payload.new as Tables<'event_state'> | null
          if (row?.id && bundleRef.current?.state.id === row.id) {
            setBundle((b) => (b ? { ...b, state: row } : b))
            return
          }
          scheduleReloadRef.current()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const row = payload.new as Tables<'teams'> | null
          const old = payload.old as Tables<'teams'> | null
          if (payload.eventType === 'DELETE' && old) {
            setBundle((b) =>
              b ? { ...b, teams: b.teams.filter((t) => t.id !== old.id) } : b,
            )
            return
          }
          if (row) {
            setBundle((b) => {
              if (!b) return b
              const idx = b.teams.findIndex((t) => t.id === row.id)
              const teams =
                idx >= 0
                  ? b.teams.map((t) => (t.id === row.id ? row : t))
                  : [...b.teams, row].sort((a, c) => a.slot_number - c.slot_number)
              return { ...b, teams }
            })
            return
          }
          scheduleReloadRef.current()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions', filter: `event_id=eq.${eventId}` },
        (payload) => {
          setBundle((b) => {
            if (!b) return b
            return {
              ...b,
              submissions: mergeSubmission(b.submissions, {
                eventType: payload.eventType as SubmissionPayload['eventType'],
                new: payload.new as Tables<'submissions'> | null,
                old: payload.old as Tables<'submissions'> | null,
              }),
            }
          })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${eventId}` },
        () => scheduleReloadRef.current(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bingo_runs', filter: `event_id=eq.${eventId}` },
        () => scheduleReloadRef.current(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (reconnectRef.current) {
            clearTimeout(reconnectRef.current)
            reconnectRef.current = null
          }
          void reloadRef.current()
          return
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          scheduleReloadRef.current()
          if (reconnectRef.current) clearTimeout(reconnectRef.current)
          reconnectRef.current = setTimeout(() => {
            setChannelCycle((n) => n + 1)
          }, 600)
        }
      })

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      void supabase.removeChannel(channel)
    }
  }, [eventId, channelCycle])

  const updateState = useCallback(
    async (patch: TablesUpdate<'event_state'>) => {
      if (!bundleRef.current?.state.id) return
      const merged = {
        ...bundleRef.current.state,
        ...patch,
        updated_at: new Date().toISOString(),
      } as Tables<'event_state'>
      setBundle((b) => (b ? { ...b, state: merged } : b))
      const { error } = await supabase
        .from('event_state')
        .update({ ...patch, updated_at: merged.updated_at })
        .eq('id', bundleRef.current.state.id)
      if (error) {
        void reload()
        throw error
      }
    },
    [reload],
  )

  const updateTeam = useCallback(
    async (teamId: string, patch: TablesUpdate<'teams'>) => {
      const prev = bundleRef.current?.teams.find((t) => t.id === teamId)
      if (prev) {
        setBundle((b) =>
          b
            ? {
                ...b,
                teams: b.teams.map((t) =>
                  t.id === teamId ? ({ ...t, ...patch } as Tables<'teams'>) : t,
                ),
              }
            : b,
        )
      }
      const { error } = await supabase.from('teams').update(patch).eq('id', teamId)
      if (error) {
        void reload()
        throw error
      }
    },
    [reload],
  )

  const resetEvent = useCallback(async () => {
    if (!eventId || !bundleRef.current) return
    await resetLiveEvent(eventId, bundleRef.current.event.team_count)
    await reload()
  }, [eventId, reload])

  return {
    bundle,
    loading,
    error,
    reload,
    updateState,
    updateTeam,
    resetEvent,
    setBundle,
  }
}

export function useChatMessages(eventId: string | undefined) {
  const [messages, setMessages] = useState<Tables<'chat_messages'>[]>([])

  const reload = useCallback(async () => {
    if (!eventId) return
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
    if (error) throw error
    setMessages(data ?? [])
  }, [eventId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!eventId) return
    const channel = supabase
      .channel(`chat:${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const row = payload.new as Tables<'chat_messages'>
          if (row) setMessages((m) => [...m, row])
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [eventId])

  const sendMessage = useCallback(
    async (sender: string, message: string, teamId?: string | null) => {
      if (!eventId) return
      const { error } = await supabase.from('chat_messages').insert({
        event_id: eventId,
        sender,
        message,
        team_id: teamId ?? null,
      })
      if (error) throw error
    },
    [eventId],
  )

  return { messages, sendMessage, reload }
}

export function useFacilitatorPresence(eventId: string | undefined, name: string | null) {
  const [others, setOthers] = useState<{ name: string }[]>([])

  useEffect(() => {
    if (!eventId || !name) return

    const channel = supabase.channel(`presence:facilitator:${eventId}`, {
      config: { presence: { key: name } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const list: { name: string }[] = []
        for (const presences of Object.values(state)) {
          for (const p of presences as { name?: string }[]) {
            if (p.name && p.name !== name) list.push({ name: p.name })
          }
        }
        setOthers(list)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name })
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [eventId, name])

  return others
}
