import type { RealtimeChannel } from '@supabase/supabase-js'

import type { BingoCell } from '@/lib/bingo-engine'
import { normalizeBingoPlayOrder } from '@/lib/bingo-run-cache'
import type { LiveEventBundle } from '@/lib/live-event'
import {
  ensureLiveEventAccess,
  getStoredLiveJoinToken,
} from '@/lib/live-event-access'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/helpers'

export type BingoRunBroadcastRow = {
  id: string
  event_id: string
  game_id: string
  stage_index: number
  playOrder: string[]
  current_play_index: number
  status: string
}

export type LiveBundlePatch =
  | { kind: 'event_state'; row: Tables<'event_state'> }
  | {
      kind: 'team'
      op: 'INSERT' | 'UPDATE' | 'DELETE'
      row?: Tables<'teams'>
      old?: Pick<Tables<'teams'>, 'id'>
    }
  | {
      kind: 'submission'
      op: 'INSERT' | 'UPDATE' | 'DELETE'
      row?: Tables<'submissions'>
      old?: Pick<Tables<'submissions'>, 'id'>
    }
  | {
      kind: 'bingo_run'
      eventId: string
      stageIndex: number
      row: BingoRunBroadcastRow | null
    }
  | { kind: 'bingo_team_card'; runId: string; teamId: string; cells: BingoCell[] }
  | { kind: 'full_reload' }

const BROADCAST_READY_TIMEOUT_MS = 3_000

type SharedChannelState = {
  channel: RealtimeChannel
  ready: Promise<void>
}

const sharedChannels = new Map<string, SharedChannelState>()
const patchListeners = new Map<string, Set<(patch: LiveBundlePatch) => void>>()

export function liveBroadcastChannelName(eventId: string, joinToken: string): string {
  return `live:${eventId}:${joinToken.slice(0, 16)}`
}

function sharedKey(eventId: string, joinToken: string): string {
  return `${eventId}:${joinToken.slice(0, 16)}`
}

function dispatchPatch(key: string, patch: LiveBundlePatch): void {
  const listeners = patchListeners.get(key)
  if (!listeners) return
  for (const fn of listeners) fn(patch)
}

/** One Realtime channel per event+token — shared by listeners and publishers. */
async function ensureSharedLiveBroadcastChannel(
  eventId: string,
  joinToken: string,
): Promise<RealtimeChannel> {
  const key = sharedKey(eventId, joinToken)
  let state = sharedChannels.get(key)
  if (!state) {
    const channel = supabase.channel(liveBroadcastChannelName(eventId, joinToken), {
      config: { broadcast: { self: true } },
    })
    channel.on('broadcast', { event: 'live_bundle' }, ({ payload }) => {
      const patch = payload as LiveBundlePatch
      if (patch?.kind) dispatchPatch(key, patch)
    })
    const ready = new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (
          status === 'SUBSCRIBED' ||
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          resolve()
        }
      })
    })
    state = {
      channel,
      ready: Promise.race([
        ready,
        new Promise<void>((resolve) => setTimeout(resolve, BROADCAST_READY_TIMEOUT_MS)),
      ]),
    }
    sharedChannels.set(key, state)
  }
  await state.ready
  return state.channel
}

function teardownSharedChannelIfIdle(key: string): void {
  const listeners = patchListeners.get(key)
  if (listeners && listeners.size > 0) return
  const state = sharedChannels.get(key)
  if (!state) return
  void supabase.removeChannel(state.channel)
  sharedChannels.delete(key)
  patchListeners.delete(key)
}

/** Subscribe to live bundle broadcast patches for an event. */
export function onLiveBundlePatch(
  eventId: string,
  joinToken: string,
  handler: (patch: LiveBundlePatch) => void,
): () => void {
  const key = sharedKey(eventId, joinToken)
  let set = patchListeners.get(key)
  if (!set) {
    set = new Set()
    patchListeners.set(key, set)
  }
  set.add(handler)
  void ensureSharedLiveBroadcastChannel(eventId, joinToken)
  return () => {
    set!.delete(handler)
    teardownSharedChannelIfIdle(key)
  }
}

function mergeSubmission(
  subs: Tables<'submissions'>[],
  op: 'INSERT' | 'UPDATE' | 'DELETE',
  row?: Tables<'submissions'>,
  old?: Pick<Tables<'submissions'>, 'id'>,
): Tables<'submissions'>[] {
  if (op === 'DELETE' && old) {
    return subs.filter((s) => s.id !== old.id)
  }
  if (!row) return subs
  const idx = subs.findIndex((s) => s.id === row.id)
  if (op === 'INSERT') {
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

export function applyLiveBundlePatch(
  bundle: LiveEventBundle,
  patch: LiveBundlePatch,
): LiveEventBundle {
  switch (patch.kind) {
    case 'event_state':
      return { ...bundle, state: patch.row }
    case 'team': {
      if (patch.op === 'DELETE' && patch.old) {
        return {
          ...bundle,
          teams: bundle.teams.filter((t) => t.id !== patch.old!.id),
        }
      }
      if (!patch.row) return bundle
      const idx = bundle.teams.findIndex((t) => t.id === patch.row!.id)
      const teams =
        idx >= 0
          ? bundle.teams.map((t) => (t.id === patch.row!.id ? patch.row! : t))
          : [...bundle.teams, patch.row].sort((a, b) => a.slot_number - b.slot_number)
      return { ...bundle, teams }
    }
    case 'submission':
      return {
        ...bundle,
        submissions: mergeSubmission(
          bundle.submissions,
          patch.op,
          patch.row,
          patch.old,
        ),
      }
    default:
      return bundle
  }
}

export async function publishLiveBundlePatch(
  eventId: string,
  patch: LiveBundlePatch,
): Promise<void> {
  const access = await ensureLiveEventAccess(eventId)
  if (!access) return
  const joinToken = getStoredLiveJoinToken(eventId)
  if (!joinToken) return
  try {
    const channel = await ensureSharedLiveBroadcastChannel(eventId, joinToken)
    await channel.send({
      type: 'broadcast',
      event: 'live_bundle',
      payload: patch,
    })
  } catch {
    // Broadcast is best-effort; never block writes on fan-out failures.
  }
}

export async function publishLiveBundleReload(eventId: string): Promise<void> {
  await publishLiveBundlePatch(eventId, { kind: 'full_reload' })
}

export async function publishSubmissionChange(
  eventId: string,
  op: 'INSERT' | 'UPDATE' | 'DELETE',
  row?: Tables<'submissions'>,
  old?: Pick<Tables<'submissions'>, 'id'>,
): Promise<void> {
  await publishLiveBundlePatch(eventId, { kind: 'submission', op, row, old })
}

export function bingoRunRowToBroadcast(row: {
  id: string
  event_id: string
  game_id: string
  stage_index: number
  play_order?: string[] | null
  playOrder?: string[]
  current_play_index: number
  status: string
}): BingoRunBroadcastRow {
  return {
    id: row.id,
    event_id: row.event_id,
    game_id: row.game_id,
    stage_index: row.stage_index,
    playOrder: normalizeBingoPlayOrder(row.playOrder ?? row.play_order),
    current_play_index: row.current_play_index,
    status: row.status,
  }
}

export type LiveBroadcastHandlers = {
  onBundlePatch?: (patch: LiveBundlePatch) => void
  onBingoRun?: (patch: Extract<LiveBundlePatch, { kind: 'bingo_run' }>) => void
  onBingoTeamCard?: (patch: Extract<LiveBundlePatch, { kind: 'bingo_team_card' }>) => void
}

export function subscribeLiveBundleBroadcast(
  eventId: string,
  handlers: LiveBroadcastHandlers,
): () => void {
  let cancelled = false
  let unsubscribe: (() => void) | undefined

  void (async () => {
    const access = await ensureLiveEventAccess(eventId)
    if (!access || cancelled) return
    const joinToken = getStoredLiveJoinToken(eventId)
    if (!joinToken || cancelled) return

    unsubscribe = onLiveBundlePatch(eventId, joinToken, (patch) => {
      handlers.onBundlePatch?.(patch)
      if (patch.kind === 'bingo_run') handlers.onBingoRun?.(patch)
      if (patch.kind === 'bingo_team_card') handlers.onBingoTeamCard?.(patch)
    })
  })()

  return () => {
    cancelled = true
    unsubscribe?.()
  }
}
