import { activateBingoRun, type ActivateBingoRunResult } from '@/lib/activate-bingo-run'
import { ensureLiveEventAccess } from '@/lib/live-event-access'
import { publishLiveBundlePatch, publishLiveBundleReload } from '@/lib/live-broadcast'
import { incrementTeamScore } from '@/lib/increment-team-score'
import { supabase } from '@/lib/supabase'
import type { GameConfig } from '@/types/game-config'

/** Delete existing run for a stage and create a fresh one (new cards + play order). */
export async function restartBingoRun(
  eventId: string,
  gameId: string,
  stageIndex: number,
): Promise<ActivateBingoRunResult> {
  await ensureLiveEventAccess(eventId)

  const [{ data: run }, { data: games }] = await Promise.all([
    supabase
      .from('bingo_runs')
      .select('paid_line_bonus_team_ids')
      .eq('event_id', eventId)
      .eq('stage_index', stageIndex)
      .maybeSingle(),
    supabase.rpc('get_live_event_games', { p_event_id: eventId }),
  ])

  const game = ((games ?? []) as { id: string; config: unknown }[]).find((g) => g.id === gameId)

  const { data: approvedSubs } = await supabase
    .from('submissions')
    .select('team_id, points_awarded')
    .eq('event_id', eventId)
    .eq('game_id', gameId)
    .eq('status', 'approved')

  const totalsByTeam = new Map<string, number>()
  for (const sub of approvedSubs ?? []) {
    const pts = sub.points_awarded ?? 0
    if (pts > 0) {
      totalsByTeam.set(sub.team_id, (totalsByTeam.get(sub.team_id) ?? 0) + pts)
    }
  }

  const linePoints = ((game?.config ?? {}) as GameConfig).bingo_line_points ?? 0
  if (run && linePoints > 0) {
    const paidIds = Array.isArray(run.paid_line_bonus_team_ids)
      ? (run.paid_line_bonus_team_ids as string[])
      : []
    for (const teamId of paidIds) {
      totalsByTeam.set(teamId, (totalsByTeam.get(teamId) ?? 0) + linePoints)
    }
  }

  for (const [teamId, total] of totalsByTeam) {
    await incrementTeamScore(teamId, -total, eventId)
  }

  await supabase
    .from('bingo_runs')
    .delete()
    .eq('event_id', eventId)
    .eq('stage_index', stageIndex)

  await publishLiveBundlePatch(eventId, {
    kind: 'bingo_run',
    eventId,
    stageIndex,
    row: null,
  })

  await supabase.from('submissions').delete().eq('event_id', eventId).eq('game_id', gameId)

  const result = await activateBingoRun(eventId, gameId, stageIndex)
  await publishLiveBundleReload(eventId)
  return result
}
