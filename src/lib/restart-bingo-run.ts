import { activateBingoRun, type ActivateBingoRunResult } from '@/lib/activate-bingo-run'
import { ensureLiveEventAccess } from '@/lib/live-event-access'
import { publishLiveBundlePatch, publishLiveBundleReload } from '@/lib/live-broadcast'
import { supabase } from '@/lib/supabase'
import type { GameConfig } from '@/types/game-config'

/** Delete existing run for a stage and create a fresh one (new cards + play order). */
export async function restartBingoRun(
  eventId: string,
  gameId: string,
  stageIndex: number,
): Promise<ActivateBingoRunResult> {
  await ensureLiveEventAccess(eventId)

  const { data: games } = await supabase.rpc('get_live_event_games', { p_event_id: eventId })
  const game = ((games ?? []) as { id: string; config: unknown }[]).find((g) => g.id === gameId)
  // Match the award default (editor shows `?? 100`); restart must reverse the
  // same amount that was paid.
  const linePoints = ((game?.config ?? {}) as GameConfig).bingo_line_points ?? 100

  // Reverse scores + delete the run and its submissions atomically, so a score
  // landing mid-restart can't leave a team's total inflated.
  const { error } = await supabase.rpc('restart_bingo_run_scores', {
    p_event_id: eventId,
    p_game_id: gameId,
    p_stage_index: stageIndex,
    p_line_points: linePoints,
  })
  if (error) throw error

  await publishLiveBundlePatch(eventId, {
    kind: 'bingo_run',
    eventId,
    stageIndex,
    row: null,
  })

  // #24: a restart re-arms every bonus challenge (one-time-per-run tracker).
  await supabase
    .from('event_state')
    .update({ bingo_used_bonus_ids: [] })
    .eq('event_id', eventId)

  const result = await activateBingoRun(eventId, gameId, stageIndex)
  await publishLiveBundleReload(eventId)
  return result
}
