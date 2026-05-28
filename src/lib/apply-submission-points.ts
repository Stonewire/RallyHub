import { supabase } from '@/lib/supabase'

/** Add awarded points to team score when a submission is approved. */
export async function applySubmissionPoints(
  teamId: string,
  points: number,
): Promise<void> {
  if (points <= 0) return
  const { data: team, error } = await supabase
    .from('teams')
    .select('score')
    .eq('id', teamId)
    .maybeSingle()
  if (error) throw error
  if (!team) return
  const { error: updateErr } = await supabase
    .from('teams')
    .update({ score: (team.score ?? 0) + points })
    .eq('id', teamId)
  if (updateErr) throw updateErr
}
