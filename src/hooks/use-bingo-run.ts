import { useEffect } from 'react'
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

export function useBingoRun(eventId: string | undefined, stageIndex: number | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!eventId || stageIndex == null || stageIndex < 0) return

    return subscribeLiveBundleBroadcast(eventId, {
      onBingoRun: (patch) => {
        if (patch.stageIndex !== stageIndex) return
        queryClient.setQueryData(
          queryKeys.bingoRun(eventId, stageIndex),
          patch.row ? broadcastRowToQueryRow(patch.row) : null,
        )
      },
      onBundlePatch: (patch) => {
        if (patch.kind === 'full_reload') {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.bingoRun(eventId, stageIndex),
          })
        }
      },
    })
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
      return {
        id: data.id,
        event_id: data.event_id,
        game_id: data.game_id,
        stage_index: data.stage_index,
        playOrder: normalizeBingoPlayOrder(data.play_order),
        current_play_index: data.current_play_index,
        status: data.status,
      }
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
    staleTime: 60_000,
  })
}
