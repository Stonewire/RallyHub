import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import type { BingoCell } from '@/lib/bingo-engine'
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

export function useBingoRun(eventId: string | undefined, stageIndex: number | undefined) {
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
        playOrder: (data.play_order as string[]) ?? [],
        current_play_index: data.current_play_index,
        status: data.status,
      }
    },
    staleTime: 60_000,
  })
}

export function useBingoTeamCard(runId: string | undefined, teamId: string | undefined) {
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
