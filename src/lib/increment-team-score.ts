import { supabase } from '@/lib/supabase'

/** Atomically adjust team score (negative delta for reversals). */
export async function incrementTeamScore(teamId: string, delta: number): Promise<void> {
  if (delta === 0) return
  const { error } = await supabase.rpc('increment_team_score', {
    p_team_id: teamId,
    p_delta: delta,
  })
  if (error) throw error
}
