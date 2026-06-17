import { supabase } from '@/lib/supabase'

import { publishLiveBundlePatch } from '@/lib/live-broadcast'

/** Atomically adjust team score (negative delta for reversals). */
export async function incrementTeamScore(
  teamId: string,
  delta: number,
  eventId?: string,
): Promise<void> {
  if (delta === 0) return
  const { error } = await supabase.rpc('increment_team_score', {
    p_team_id: teamId,
    p_delta: delta,
  })
  if (error) throw error
  if (!eventId) return
  const { data } = await supabase.from('teams').select('*').eq('id', teamId).single()
  if (data) {
    await publishLiveBundlePatch(eventId, { kind: 'team', op: 'UPDATE', row: data })
  }
}
