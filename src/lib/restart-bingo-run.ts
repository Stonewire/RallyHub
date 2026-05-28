import { activateBingoRun } from '@/lib/activate-bingo-run'
import { supabase } from '@/lib/supabase'

/** Delete existing run for a stage and create a fresh one (new cards + secret winner). */
export async function restartBingoRun(
  eventId: string,
  gameId: string,
  stageIndex: number,
): Promise<void> {
  await supabase
    .from('bingo_runs')
    .delete()
    .eq('event_id', eventId)
    .eq('stage_index', stageIndex)

  await supabase.from('submissions').delete().eq('event_id', eventId).eq('game_id', gameId)

  await activateBingoRun(eventId, gameId, stageIndex)
}
