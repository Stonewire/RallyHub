import { useQuery } from '@tanstack/react-query'

import { i18n } from '@/lib/i18n'
import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/helpers'

export type ActivityLogRow = Tables<'event_activity_log'>

/**
 * i18n keys, not text: the label must re-resolve after a language change.
 * The map is deliberately partial. `action` is a free-form string column, so
 * anything the log grows before this map does must still be readable.
 */
export const ACTION_LABEL_KEYS: Record<string, string> = {
  team_joined: 'events.log.actions.teamJoined',
  facilitator_joined: 'events.log.actions.facilitatorJoined',
  stage_changed: 'events.log.actions.stageChanged',
  submission_approved: 'events.log.actions.submissionApproved',
  submission_rejected: 'events.log.actions.submissionRejected',
  winner_revealed: 'events.log.actions.winnerRevealed',
}

/**
 * An unmapped action falls back to the raw action string, exactly as before.
 * Never pass it to t(): that would print the key itself.
 */
export function activityActionText(action: string): string {
  const key = ACTION_LABEL_KEYS[action]
  return key ? i18n.t(`admin:${key}`) : action
}

export function activityActionLabel(row: ActivityLogRow): string {
  const base = activityActionText(row.action)
  if (row.action === 'stage_changed' && row.details) {
    const d = row.details as { stage_name?: string; stage_index?: number }
    const idx = d.stage_index !== undefined ? `#${d.stage_index + 1}` : ''
    const name = d.stage_name ? ` "${d.stage_name}"` : ''
    return `${base}${name} ${idx}`.trim()
  }
  if (row.action === 'submission_approved' && row.details) {
    const d = row.details as { points?: number; game_name?: string }
    const pts = d.points !== undefined ? ` (+${d.points} pts)` : ''
    const game = d.game_name ? `, ${d.game_name}` : ''
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
