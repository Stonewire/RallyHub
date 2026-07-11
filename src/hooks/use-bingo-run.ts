import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import type { BingoCell } from '@/lib/bingo-engine'
import { normalizeBingoPlayOrder } from '@/lib/bingo-run-cache'
import type { BingoRunBroadcastRow } from '@/lib/live-broadcast'
import { subscribeLiveBundleBroadcast } from '@/lib/live-broadcast'
import { supabase } from '@/lib/supabase'

export type BingoRunRow = {
  id: string
  event_id: string
  game_id: string
  stage_index: number
  playOrder: string[]
  current_play_index: number
  status: string
}

// P1-1 recovery poll: how often to check the DB, and how long the facilitator's
// broadcast must be silent before the poll is allowed to act. While broadcasts
// flow (facilitator present) the poll is a no-op, so normal play is unchanged.
const RUN_POLL_INTERVAL_MS = 3000
const BROADCAST_STALE_MS = 6000

/**
 * Decide whether a polled bingo_runs row should replace the cached one.
 * The play index only ever moves forward within a run, so a poll may advance it
 * (recovering a missed broadcast) but must never rewind it on a stale read. A
 * changed run id or status is always accepted (new run / pause / end / restart).
 * A null poll is ignored so a transient empty read can't wipe a live run.
 */
export function pickRecoveredBingoRun(
  cached: BingoRunRow | null,
  polled: BingoRunRow | null,
): BingoRunRow | null {
  if (!polled) return cached
  if (!cached) return polled
  if (polled.id !== cached.id) return polled
  if (polled.status !== cached.status) return polled
  if (polled.current_play_index > cached.current_play_index) return polled
  return cached
}

function broadcastRowToQueryRow(row: BingoRunBroadcastRow): BingoRunRow {
  return {
    id: row.id,
    event_id: row.event_id,
    game_id: row.game_id,
    stage_index: row.stage_index,
    playOrder: normalizeBingoPlayOrder(row.playOrder),
    current_play_index: row.current_play_index,
    status: row.status,
  }
}

function dbRowToQueryRow(data: {
  id: string
  event_id: string
  game_id: string
  stage_index: number
  play_order: unknown
  current_play_index: number
  status: string
}): BingoRunRow {
  return {
    id: data.id,
    event_id: data.event_id,
    game_id: data.game_id,
    stage_index: data.stage_index,
    playOrder: normalizeBingoPlayOrder(data.play_order),
    current_play_index: data.current_play_index,
    status: data.status,
  }
}

export function useBingoRun(eventId: string | undefined, stageIndex: number | undefined) {
  const queryClient = useQueryClient()
  // Last time the facilitator's broadcast touched this run. The recovery poll
  // only acts once this goes stale, so a connected facilitator always wins.
  const lastBroadcastAtRef = useRef(0)

  useEffect(() => {
    if (!eventId || stageIndex == null || stageIndex < 0) return

    return subscribeLiveBundleBroadcast(eventId, {
      onBingoRun: (patch) => {
        if (patch.stageIndex !== stageIndex) return
        lastBroadcastAtRef.current = Date.now()
        queryClient.setQueryData(
          queryKeys.bingoRun(eventId, stageIndex),
          patch.row ? broadcastRowToQueryRow(patch.row) : null,
        )
      },
      onBundlePatch: (patch) => {
        if (patch.kind === 'full_reload') {
          lastBroadcastAtRef.current = Date.now()
          void queryClient.invalidateQueries({
            queryKey: queryKeys.bingoRun(eventId, stageIndex),
          })
        }
      },
    })
  }, [eventId, stageIndex, queryClient])

  // P1-1: recover bingo playback if the facilitator's tab closes. The current
  // song index is written to bingo_runs on every advance, so when broadcasts go
  // silent we poll the DB and move players forward. Guarded by
  // pickRecoveredBingoRun so a stale read can never rewind an active run, and
  // skipped entirely while broadcasts are flowing (normal play is untouched).
  useEffect(() => {
    if (!eventId || stageIndex == null || stageIndex < 0) return
    let cancelled = false

    const tick = async () => {
      if (Date.now() - lastBroadcastAtRef.current < BROADCAST_STALE_MS) return
      const { data, error } = await supabase
        .from('bingo_runs')
        .select('*')
        .eq('event_id', eventId)
        .eq('stage_index', stageIndex)
        .maybeSingle()
      if (cancelled || error) return
      const polled = data ? dbRowToQueryRow(data) : null
      const key = queryKeys.bingoRun(eventId, stageIndex)
      const cached = queryClient.getQueryData<BingoRunRow | null>(key) ?? null
      const next = pickRecoveredBingoRun(cached, polled)
      if (next !== cached) queryClient.setQueryData(key, next)
    }

    const interval = setInterval(() => void tick(), RUN_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [eventId, stageIndex, queryClient])

  return useQuery({
    queryKey: queryKeys.bingoRun(eventId ?? '', stageIndex ?? -1),
    enabled: Boolean(eventId) && stageIndex != null && stageIndex >= 0,
    queryFn: async (): Promise<BingoRunRow | null> => {
      if (!eventId || stageIndex == null) return null
      const { data, error } = await supabase
        .from('bingo_runs')
        .select('*')
        .eq('event_id', eventId)
        .eq('stage_index', stageIndex)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return dbRowToQueryRow(data)
    },
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

export function useBingoTeamCard(
  eventId: string | undefined,
  runId: string | undefined,
  teamId: string | undefined,
) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!eventId || !runId || !teamId) return

    return subscribeLiveBundleBroadcast(eventId, {
      onBingoTeamCard: (patch) => {
        if (patch.runId !== runId || patch.teamId !== teamId) return
        queryClient.setQueryData(['bingo-team-card', runId, teamId], patch.cells)
      },
      onBundlePatch: (patch) => {
        if (patch.kind === 'full_reload') {
          void queryClient.invalidateQueries({
            queryKey: ['bingo-team-card', runId, teamId],
          })
        }
      },
    })
  }, [eventId, runId, teamId, queryClient])

  return useQuery({
    queryKey: ['bingo-team-card', runId, teamId],
    enabled: Boolean(runId && teamId),
    queryFn: async (): Promise<BingoCell[] | null> => {
      if (!runId || !teamId) return null
      const { data, error } = await supabase
        .from('bingo_team_cards')
        .select('cells')
        .eq('run_id', runId)
        .eq('team_id', teamId)
        .maybeSingle()
      if (error) throw error
      return (data?.cells as BingoCell[]) ?? null
    },
    staleTime: 0,
    refetchOnMount: 'always',
  })
}
