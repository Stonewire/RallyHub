import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/helpers'

export type ActivityLogRow = Tables<'event_activity_log'>

const ACTION_LABELS: Record<string, string> = {
  team_joined: 'Joined the event',
  facilitator_joined: 'Connected as facilitator',
  stage_changed: 'Advanced to stage',
  submission_approved: 'Submission approved',
  submission_rejected: 'Submission rejected',
  winner_revealed: 'Winner reveal started',
}

export function activityActionLabel(row: ActivityLogRow): string {
  const base = ACTION_LABELS[row.action] ?? row.action
  if (row.action === 'stage_changed' && row.details) {
    const d = row.details as { stage_name?: string; stage_index?: number }
    const idx = d.stage_index !== undefined ? `#${d.stage_index + 1}` : ''
    const name = d.stage_name ? ` "${d.stage_name}"` : ''
    return `${base}${name} ${idx}`.trim()
  }
  if (row.action === 'submission_approved' && row.details) {
    const d = row.details as { points?: number; game_name?: string }
    const pts = d.points !== undefined ? ` (+${d.points} pts)` : ''
    const game = d.game_name ? ` — ${d.game_name}` : ''
    return `${base}${pts}${game}`
  }
  return base
}

export function useEventActivityLog(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.eventActivityLog(eventId),
    enabled: Boolean(eventId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_activity_log')
        .select('*')
        .eq('event_id', eventId!)
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return data as ActivityLogRow[]
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
