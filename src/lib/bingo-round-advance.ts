import { scoreBingoRound } from '@/lib/bingo-scoring'
import { supabase } from '@/lib/supabase'
import type { GameConfig } from '@/types/game-config'

/** Score current song (if needed), clear pending cell marks, advance play index. */
export async function advanceBingoTrack(params: {
  eventId: string
  gameId: string
  runId: string | undefined
  playOrder: string[]
  currentIndex: number
  scoreCurrent: boolean
  gameConfig?: GameConfig
}): Promise<number> {
  const { eventId, gameId, runId, playOrder, currentIndex, scoreCurrent, gameConfig } =
    params
  const trackId = playOrder[currentIndex]

  if (scoreCurrent && trackId && runId) {
    await scoreBingoRound({
      eventId,
      gameId,
      runId,
      trackId,
      gameConfig: gameConfig ?? {},
    })
  }

  const { data: pending } = await supabase
    .from('submissions')
    .select('id, media_url')
    .eq('event_id', eventId)
    .eq('game_id', gameId)
    .eq('media_type', 'bingo')
    .eq('status', 'pending')

  const toClear = (pending ?? []).filter(
    (s) => s.media_url != null && s.media_url !== 'claim',
  )
  if (toClear.length > 0) {
    await supabase
      .from('submissions')
      .delete()
      .in(
        'id',
        toClear.map((s) => s.id),
      )
  }

  const nextIndex = Math.min(Math.max(0, playOrder.length - 1), currentIndex + 1)

  if (runId) {
    await supabase
      .from('bingo_runs')
      .update({ current_play_index: nextIndex })
      .eq('id', runId)
  }

  return nextIndex
}
