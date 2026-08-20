import { useCallback, useEffect, useRef, useState } from 'react'

import { i18n, setLiveLanguage } from '@/lib/i18n'
import type { LiveEventBundle } from '@/lib/live-event'
import {
  applyLiveBundlePatch,
  onLiveBundlePatch,
  publishLiveBundlePatch,
} from '@/lib/live-broadcast'
import {
  clearLiveEventAccess,
  ensureLiveEventAccess,
  getStoredLiveJoinToken,
} from '@/lib/live-event-access'
import { fetchOrganizationTenantPublic } from '@/lib/organization-tenant'
import { supabase } from '@/lib/supabase'
import { saveBundleSnapshot, loadBundleSnapshot } from '@/lib/offline/bundle-snapshot'
import type { Tables, TablesUpdate } from '@/types/helpers'

const RELOAD_DEBOUNCE_MS = 280
/** Recent submissions kept in the live bundle; scoring paths that need more query the DB directly. */
const SUBMISSIONS_BUNDLE_LIMIT = 1000

async function fetchEventSubmissions(eventId: string): Promise<Tables<'submissions'>[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(SUBMISSIONS_BUNDLE_LIMIT)

  if (error) throw error
  return data ?? []
}

async function fetchBundle(eventId: string): Promise<LiveEventBundle | null> {
  // An EXPIRED stored join token fails silently: ensureLiveEventAccess keeps
  // trusting it, RLS filters every read to empty, and the app looks dead until
  // the browser process restarts (seen on a phone reopening the event hours
  // later). When a load comes back empty/broken while online with a stored
  // token, drop the token, mint a fresh one, and retry once.
  const staleTokenSuspect = () => navigator.onLine && Boolean(getStoredLiveJoinToken(eventId))
  try {
    const bundle = await fetchBundleOnce(eventId)
    if (bundle) return bundle
    if (!staleTokenSuspect()) return null
  } catch (err) {
    if (!staleTokenSuspect()) throw err
  }
  clearLiveEventAccess(eventId)
  return fetchBundleOnce(eventId)
}

async function fetchBundleOnce(eventId: string): Promise<LiveEventBundle | null> {
  const access = await ensureLiveEventAccess(eventId)
  if (!access) return null

  const { data: event, error: eErr } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle()

  if (eErr) throw eErr
  if (!event) return null

  const [orgRes, stateRes, teamsRes, gamesRes] = await Promise.all([
    fetchOrganizationTenantPublic(event.organization_id),
    supabase.from('event_state').select('*').eq('event_id', eventId).maybeSingle(),
    supabase.from('teams').select('*').eq('event_id', eventId).order('slot_number'),
    supabase.rpc('get_live_event_games', { p_event_id: eventId }),
  ])

  if (stateRes.error) throw stateRes.error
  if (teamsRes.error) throw teamsRes.error
  if (gamesRes.error) throw gamesRes.error

  let state = stateRes.data
  if (!state) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.user) {
      const { data: created, error } = await supabase
        .from('event_state')
        .insert({ event_id: eventId })
        .select()
        .single()
      if (!error && created) state = created
    }
    if (!state) {
      throw new Error(i18n.t('live:event.notReady'))
    }
  }

  const games = (gamesRes.data ?? []) as Tables<'games'>[]

  const submissions = await fetchEventSubmissions(eventId)

  return {
    event,
    organization: orgRes ?? null,
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

function mergeGame(
  games: Tables<'games'>[],
  payload: { eventType: string; new: unknown; old: unknown },
): Tables<'games'>[] {
  if (payload.eventType === 'DELETE') {
    const old = payload.old as Tables<'games'> | null
    if (!old?.id || !games.some((g) => g.id === old.id)) return games
    return games.filter((g) => g.id !== old.id)
  }
  const row = payload.new as Tables<'games'> | null
  if (!row?.id) return games
  const idx = games.findIndex((g) => g.id === row.id)
  if (idx >= 0) {
    if (games[idx] === row) return games
    const next = [...games]
    next[idx] = row
    return next
  }
  return [...games, row]
}

export function useLiveEvent(eventId: string | undefined) {
  const [bundle, setBundle] = useState<LiveEventBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [channelCycle, setChannelCycle] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const bundleRef = useRef(bundle)
  const lastWrittenAtRef = useRef<string | null>(null)
  // eslint-disable-next-line react-hooks/refs -- standard "keep ref fresh" idiom for effects/callbacks below that read the latest bundle without depending on it
  bundleRef.current = bundle

  // All live surfaces (join, display, facilitator, tablet via /join) follow
  // the organizer's per-event language. On a multilingual event a participant
  // tab pins its team's own choice, which setLiveLanguage lets win; the
  // display and facilitator panel never pin, so they stay on the event.
  const eventLanguage = bundle?.event.language
  useEffect(() => {
    if (eventLanguage) void setLiveLanguage(eventLanguage)
  }, [eventLanguage])

  const reload = useCallback(async () => {
    if (!eventId) return
    try {
      const data = await fetchBundle(eventId)
      if (!data && !navigator.onLine) {
        // Offline boot: access bootstrap or the event fetch failed with no
        // network. Fall back to the last-good snapshot rather than a dead
        // "Event not found" — the live data replaces it on reconnect.
        const snap = await loadBundleSnapshot(eventId)
        if (snap) {
          setBundle(snap)
          setError(null)
          return
        }
      }
      setBundle(data)
      setError(data ? null : i18n.t('live:join.claim.eventNotFound'))
    } catch (err) {
      const snap = await loadBundleSnapshot(eventId).catch(() => null)
      if (snap) {
        // A fetch that died mid-flight (connection dropped) must not blank a
        // surface we can still render from the snapshot.
        setBundle((current) => current ?? snap)
        setError(null)
      } else {
        setError(err instanceof Error ? err.message : i18n.t('live:event.loadFailed'))
      }
    } finally {
      setLoading(false)
    }
  }, [eventId])

  // Persist the last-good bundle (debounced; submissions can be hundreds of
  // rows) so a reload with no connection still has something to show.
  useEffect(() => {
    if (!eventId || !bundle) return
    const t = setTimeout(() => void saveBundleSnapshot(eventId, bundle), 1000)
    return () => clearTimeout(t)
  }, [eventId, bundle])

  const scheduleReload = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      void reload()
    }, RELOAD_DEBOUNCE_MS)
  }, [reload])

  const reloadRef = useRef(reload)
  // eslint-disable-next-line react-hooks/refs -- standard "keep ref fresh" idiom
  reloadRef.current = reload
  const scheduleReloadRef = useRef(scheduleReload)
  // eslint-disable-next-line react-hooks/refs -- standard "keep ref fresh" idiom
  scheduleReloadRef.current = scheduleReload

  const eventGameIdsKey = (bundle?.games ?? [])
    .map((g) => g.id)
    .sort()
    .join('|')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount/dependency-change pattern; reload's setState calls happen after an await, not synchronously
    void reload()
  }, [reload])

  // Safety-net poll for event_state. Anonymous players don't reliably receive
  // Realtime (postgres_changes needs the join-token header it can't send, and
  // broadcast depends on the facilitator being connected). Polling the single
  // lightweight state row every few seconds guarantees quiz reveal, bingo state,
  // announcements, etc. reach players even if Realtime is silent. Cheap: one row.
  useEffect(() => {
    if (!eventId) return
    let cancelled = false
    const tick = async () => {
      const access = await ensureLiveEventAccess(eventId)
      if (!access || cancelled) return
      const { data: row } = await supabase
        .from('event_state')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle()
      if (cancelled || !row) return
      setBundle((b) => {
        if (!b || b.state.id !== row.id) return b
        // Don't clobber a newer optimistic/realtime update.
        if (
          b.state.updated_at &&
          row.updated_at &&
          row.updated_at <= b.state.updated_at
        ) {
          return b
        }
        return { ...b, state: row }
      })
    }
    const interval = setInterval(() => void tick(), 4000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [eventId])

  useEffect(() => {
    if (!eventId) return

    let cancelled = false
    let unsubscribeBroadcast: (() => void) | undefined

    void (async () => {
      const access = await ensureLiveEventAccess(eventId)
      if (!access || cancelled) return
      const joinToken = getStoredLiveJoinToken(eventId)
      if (!joinToken || cancelled) return

      unsubscribeBroadcast = onLiveBundlePatch(eventId, joinToken, (patch) => {
        if (patch.kind === 'full_reload') {
          scheduleReloadRef.current()
          return
        }
        if (patch.kind === 'bingo_run' || patch.kind === 'bingo_team_card') {
          return
        }
        setBundle((b) => {
          if (!b) return b
          if (patch.kind === 'event_state') {
            // Drop a stale event_state snapshot that would clobber newer local
            // state. Without this, a late bingo-activation broadcast (carrying
            // 'waiting') can overwrite the facilitator's optimistic 'playing',
            // making Start need multiple presses. Mirrors the poll (updated_at
            // check) and the postgres_changes handler (lastWrittenAtRef check).
            const incoming = patch.row.updated_at
            const localWrite = lastWrittenAtRef.current
            const localState = b.state.updated_at
            if (
              incoming &&
              ((localWrite && incoming < localWrite) ||
                (localState && incoming < localState))
            ) {
              return b
            }
          }
          return applyLiveBundlePatch(b, patch)
        })
      })
    })()

    const channel = supabase.channel(`live:event:${eventId}:bundle`)
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
            // Skip stale echoes that arrive while an optimistic update is in flight
            if (lastWrittenAtRef.current && row.updated_at && row.updated_at < lastWrittenAtRef.current) return
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

    // NOTE: do not add a postgres_changes listener for `event_games` here — that
    // table is not in the supabase_realtime publication, and subscribing to an
    // unpublished table makes the whole channel fail with CHANNEL_ERROR (no live
    // updates at all). Mid-event game changes already propagate via the `events`
    // listener above (saving an event updates the events row → scheduleReload).

    for (const gameId of eventGameIdsKey ? eventGameIdsKey.split('|') : []) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          setBundle((b) => {
            if (!b) return b
            const games = mergeGame(b.games, payload)
            if (games === b.games) return b
            return { ...b, games }
          })
        },
      )
    }

    channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (reconnectRef.current) {
            clearTimeout(reconnectRef.current)
            reconnectRef.current = null
          }
          reconnectAttemptsRef.current = 0
          void reloadRef.current()
          return
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          scheduleReloadRef.current()
          if (reconnectRef.current) clearTimeout(reconnectRef.current)
          // Exponential backoff, capped at 10s, so a flaky venue network can't
          // trigger a reconnect storm.
          const attempt = reconnectAttemptsRef.current
          reconnectAttemptsRef.current = attempt + 1
          const delay = Math.min(600 * 2 ** attempt, 10000)
          reconnectRef.current = setTimeout(() => {
            setChannelCycle((n) => n + 1)
          }, delay)
        }
      })

    return () => {
      cancelled = true
      unsubscribeBroadcast?.()
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      void supabase.removeChannel(channel)
    }
  }, [eventId, channelCycle, eventGameIdsKey])

  // P2-1: assumes a single facilitator per event. This does a read-merge-write
  // against the locally cached state, not a DB-level compare-and-swap — two
  // facilitators editing the same event concurrently can silently overwrite
  // each other's changes (last write wins, no conflict error). Fine for the
  // documented single-facilitator workflow; would need a version/etag column
  // on event_state to detect and reject stale writes if that changes.
  const updateState = useCallback(
    async (patch: TablesUpdate<'event_state'>) => {
      if (!bundleRef.current?.state.id) return
      const merged = {
        ...bundleRef.current.state,
        ...patch,
        updated_at: new Date().toISOString(),
      } as Tables<'event_state'>
      lastWrittenAtRef.current = merged.updated_at
      setBundle((b) => (b ? { ...b, state: merged } : b))
      const { error } = await supabase
        .from('event_state')
        .update({ ...patch, updated_at: merged.updated_at })
        .eq('id', bundleRef.current.state.id)
      if (error) {
        void reload()
        throw error
      }
      if (eventId) {
        await publishLiveBundlePatch(eventId, { kind: 'event_state', row: merged })
      }
    },
    [eventId, reload],
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
      const { data, error } = await supabase
        .from('teams')
        .update(patch)
        .eq('id', teamId)
        .select()
        .single()
      if (error) {
        void reload()
        throw error
      }
      if (eventId && data) {
        await publishLiveBundlePatch(eventId, {
          kind: 'team',
          op: 'UPDATE',
          row: data,
        })
      }
    },
    [eventId, reload],
  )

  return {
    bundle,
    loading,
    error,
    reload,
    updateState,
    updateTeam,
    setBundle,
  }
}

function mergeChatMessage(
  prev: Tables<'chat_messages'>[],
  row: Tables<'chat_messages'>,
): Tables<'chat_messages'>[] {
  if (prev.some((m) => m.id === row.id)) return prev
  return [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

function chatBroadcastChannelName(eventId: string, joinToken: string): string {
  return `chat:${eventId}:${joinToken.slice(0, 16)}`
}

export function useChatMessages(eventId: string | undefined) {
  const [messages, setMessages] = useState<Tables<'chat_messages'>[]>([])
  const [chatHistoryReady, setChatHistoryReady] = useState(false)
  const reloadGenRef = useRef(0)
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const appendMessage = useCallback((row: Tables<'chat_messages'>) => {
    setMessages((prev) => mergeChatMessage(prev, row))
  }, [])

  const reload = useCallback(async () => {
    if (!eventId) {
      setMessages([])
      setChatHistoryReady(false)
      return
    }

    const gen = ++reloadGenRef.current
    const access = await ensureLiveEventAccess(eventId)
    if (!access) {
      if (gen === reloadGenRef.current) {
        setChatHistoryReady(true)
      }
      return
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
    if (gen !== reloadGenRef.current) return
    if (error) throw error
    setMessages(data ?? [])
    setChatHistoryReady(true)
  }, [eventId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount/dependency-change pattern; reload's setState calls happen after an await, not synchronously
    void reload()
  }, [reload])

  useEffect(() => {
    if (!eventId) return

    let cancelled = false
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let reconnectAttempts = 0
    let subscribedOnce = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    void (async () => {
      const access = await ensureLiveEventAccess(eventId)
      if (!access || cancelled) return

      const joinToken = getStoredLiveJoinToken(eventId)
      if (!joinToken || cancelled) return

      channel = supabase
        .channel(chatBroadcastChannelName(eventId, joinToken), {
          config: { broadcast: { self: true } },
        })
        .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
          const row = payload as Tables<'chat_messages'>
          if (!row?.id || row.event_id !== eventId) return
          appendMessage(row)
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `event_id=eq.${eventId}`,
          },
          (payload) => {
            const row = payload.new as Tables<'chat_messages'>
            if (!row?.id) return
            appendMessage(row)
          },
        )
        .subscribe((status) => {
          if (cancelled) return
          if (status === 'SUBSCRIBED') {
            broadcastChannelRef.current = channel
            reconnectAttempts = 0
            if (subscribedOnce) void reload()
            subscribedOnce = true
            return
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            broadcastChannelRef.current = null
            if (reconnectTimer) clearTimeout(reconnectTimer)
            // Exponential backoff, capped at 10s.
            const delay = Math.min(600 * 2 ** reconnectAttempts, 10000)
            reconnectAttempts += 1
            reconnectTimer = setTimeout(() => void reload(), delay)
          }
        })
    })()

    return () => {
      cancelled = true
      broadcastChannelRef.current = null
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [eventId, reload, appendMessage])

  const sendMessage = useCallback(
    async (sender: string, message: string, teamId?: string | null) => {
      if (!eventId) return
      const trimmedSender = sender.trim()
      const trimmedMessage = message.trim()
      if (!trimmedSender || !trimmedMessage) return

      const access = await ensureLiveEventAccess(eventId)
      if (!access) throw new Error(i18n.t('live:event.accessDenied'))

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          event_id: eventId,
          sender: trimmedSender,
          message: trimmedMessage,
          team_id: teamId ?? null,
        })
        .select()
        .single()
      if (error) throw error
      if (!data) return

      appendMessage(data)
      await broadcastChannelRef.current?.send({
        type: 'broadcast',
        event: 'chat_message',
        payload: data,
      })
    },
    [eventId, appendMessage],
  )

  return { messages, chatHistoryReady, sendMessage, reload }
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
