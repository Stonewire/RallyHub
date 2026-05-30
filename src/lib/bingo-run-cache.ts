import type { BingoRunRow } from '@/hooks/use-bingo-run'
import type { ActivateBingoRunResult } from '@/lib/activate-bingo-run'

export function bingoRunRowFromActivation(
  eventId: string,
  gameId: string,
  stageIndex: number,
  result: ActivateBingoRunResult,
): BingoRunRow {
  return {
    id: result.runId,
    event_id: eventId,
    game_id: gameId,
    stage_index: stageIndex,
    playOrder: result.playOrder,
    current_play_index: result.currentPlayIndex,
    status: 'active',
  }
}
