import type { RealtimeChannel } from '@supabase/supabase-js'

import type { BingoCell } from '@/lib/bingo-engine'
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

const publisherChannels = new Map<string, RealtimeChannel>()

export function liveBroadcastChannelName(eventId: string, joinToken: string): string {
  return `live:${eventId}:${joinToken.slice(0, 16)}`
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

async function ensureLiveBroadcastPublisher(
  eventId: string,
  joinToken: string,
): Promise<RealtimeChannel | null> {
  const key = `${eventId}:${joinToken.slice(0, 16)}`
  const existing = publisherChannels.get(key)
  if (existing) return existing

  const channel = supabase.channel(liveBroadcastChannelName(eventId, joinToken), {
    config: { broadcast: { self: true } },
  })
  publisherChannels.set(key, channel)
  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        resolve()
      }
    })
  })
  return channel
}

export async function publishLiveBundlePatch(
  eventId: string,
  patch: LiveBundlePatch,
): Promise<void> {
  const access = await ensureLiveEventAccess(eventId)
  if (!access) return
  const joinToken = getStoredLiveJoinToken(eventId)
  if (!joinToken) return
  const channel = await ensureLiveBroadcastPublisher(eventId, joinToken)
  await channel?.send({
    type: 'broadcast',
    event: 'live_bundle',
    payload: patch,
  })
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
    playOrder: row.playOrder ?? (row.play_order as string[]) ?? [],
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
  let channel: RealtimeChannel | null = null

  void (async () => {
    const access = await ensureLiveEventAccess(eventId)
    if (!access || cancelled) return
    const joinToken = getStoredLiveJoinToken(eventId)
    if (!joinToken || cancelled) return

    channel = supabase
      .channel(liveBroadcastChannelName(eventId, joinToken), {
        config: { broadcast: { self: true } },
      })
      .on('broadcast', { event: 'live_bundle' }, ({ payload }) => {
        const patch = payload as LiveBundlePatch
        if (!patch?.kind) return
        handlers.onBundlePatch?.(patch)
        if (patch.kind === 'bingo_run') handlers.onBingoRun?.(patch)
        if (patch.kind === 'bingo_team_card') handlers.onBingoTeamCard?.(patch)
      })
      .subscribe()
  })()

  return () => {
    cancelled = true
    if (channel) void supabase.removeChannel(channel)
  }
}
