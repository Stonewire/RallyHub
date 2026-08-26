import type { BingoRunRow } from '@/hooks/use-bingo-run'
import { normalizeBingoPlayOrder } from '@/lib/bingo-run-cache'
import { publishLiveBundlePatch } from '@/lib/live-broadcast'
import { supabase } from '@/lib/supabase'

/**
 * P2.2 (Start needing multiple presses): when Start is pressed before the run
 * row exists, the press plays the positional fallback clip immediately (the
 * gesture rule: audio must start inside the press). The run's shuffled play
 * order almost never has that clip at the pressed index, so once the run
 * lands we swap the played clip into that position. Reveal and scoring read
 * the play order from the DB, so after the swap they match what the room
 * actually heard.
 *
 * Pure planning half. Returns the corrected order, or null when no rewrite is
 * needed or none is safely possible:
 * - the played clip already sits at the pressed index (nothing to do)
 * - the played clip is not in the order at all (cannot reconcile)
 * - the played clip sits BEFORE the pressed index (already played or revealed
 *   in an earlier round: never rewrite history)
 * - the index is out of range or the order is malformed
 */
export function reconcileBingoPlayOrder(
  playOrder: unknown,
  index: number,
  playedTrackId: string,
): string[] | null {
  const order = normalizeBingoPlayOrder(playOrder)
  if (!playedTrackId || index < 0 || index >= order.length) return null
  if (order[index] === playedTrackId) return null
  const from = order.indexOf(playedTrackId)
  if (from === -1) return null
  if (from < index) return null
  const next = [...order]
  next[from] = next[index]
  next[index] = playedTrackId
  return next
}

/**
 * Persist the reconciled play order and fan it out. The update is guarded on
 * current_play_index still being what it was when the run row was read, so a
 * run that advanced while the reconcile was in flight is never rewritten (the
 * update then matches zero rows). It is deliberately NOT guarded on the
 * pressed index itself: on stage re-entry the event state round resets to 0
 * while the DB run keeps its stale index from the previous pass, and that
 * replay must still reconcile. Returns the updated run row, or null when
 * nothing was written.
 */
export async function reconcileBingoRunToPlayedTrack(params: {
  eventId: string
  run: BingoRunRow
  index: number
  playedTrackId: string
}): Promise<BingoRunRow | null> {
  const { eventId, run, index, playedTrackId } = params
  const nextOrder = reconcileBingoPlayOrder(run.playOrder, index, playedTrackId)
  if (!nextOrder) return null

  const { data: runRow, error } = await supabase
    .from('bingo_runs')
    .update({ play_order: nextOrder })
    .eq('id', run.id)
    .eq('current_play_index', run.current_play_index)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!runRow) return null

  const updated: BingoRunRow = {
    id: runRow.id,
    event_id: runRow.event_id,
    game_id: runRow.game_id,
    stage_index: runRow.stage_index,
    playOrder: normalizeBingoPlayOrder(runRow.play_order),
    current_play_index: runRow.current_play_index,
    status: runRow.status,
  }

  void publishLiveBundlePatch(eventId, {
    kind: 'bingo_run',
    eventId,
    stageIndex: updated.stage_index,
    row: {
      id: updated.id,
      event_id: updated.event_id,
      game_id: updated.game_id,
      stage_index: updated.stage_index,
      playOrder: updated.playOrder,
      current_play_index: updated.current_play_index,
      status: updated.status,
    },
  }).catch(() => {
    // Best-effort fan-out, same as advanceBingoTrack: polling stays authoritative.
  })

  return updated
}
