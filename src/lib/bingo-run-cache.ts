import type { BingoRunRow } from '@/hooks/use-bingo-run'
import type { ActivateBingoRunResult } from '@/lib/activate-bingo-run'

/** Coerce DB / edge play_order into a string[] (null or malformed JSON must not crash UI). */
export function normalizeBingoPlayOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0)
}

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
    playOrder: normalizeBingoPlayOrder(result.playOrder),
    current_play_index: result.currentPlayIndex ?? 0,
    status: 'active',
  }
}
