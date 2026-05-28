import { useCallback, useEffect, useState } from 'react'

import type { LiveEventBundle } from '@/lib/live-event'
import { resetLiveEvent } from '@/lib/reset-live-event'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesUpdate } from '@/types/helpers'

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

export function useLiveEvent(eventId: string | undefined) {
  const [bundle, setBundle] = useState<LiveEventBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!eventId) return

    const channel = supabase
      .channel(`live:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `id=eq.${eventId}` },
        () => void reload(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_state', filter: `event_id=eq.${eventId}` },
        () => void reload(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `event_id=eq.${eventId}` },
        () => void reload(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions', filter: `event_id=eq.${eventId}` },
        () => void reload(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${eventId}` },
        () => void reload(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bingo_runs', filter: `event_id=eq.${eventId}` },
        () => void reload(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bingo_team_cards' },
        () => void reload(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [eventId, reload])

  const updateState = useCallback(
    async (patch: TablesUpdate<'event_state'>) => {
      if (!bundle?.state.id) return
      const { error } = await supabase
        .from('event_state')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', bundle.state.id)
      if (error) throw error
    },
    [bundle?.state.id],
  )

  const updateTeam = useCallback(
    async (teamId: string, patch: TablesUpdate<'teams'>) => {
      const { error } = await supabase.from('teams').update(patch).eq('id', teamId)
      if (error) throw error
    },
    [],
  )

  const resetEvent = useCallback(async () => {
    if (!eventId || !bundle) return
    await resetLiveEvent(eventId, bundle.event.team_count)
    await reload()
  }, [eventId, bundle, reload])

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
        () => void reload(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [eventId, reload])

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
      await reload()
    },
    [eventId, reload],
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
