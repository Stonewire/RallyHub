import type { BingoCell } from '@/lib/bingo-engine'
import { supabase } from '@/lib/supabase'

/** Approve/reject team marks for the track that was just played. */
export async function scoreBingoRound(params: {
  eventId: string
  gameId: string
  runId: string
  trackId: string
}): Promise<void> {
  const { eventId, gameId, runId, trackId } = params

  const [{ data: cards }, { data: subs }] = await Promise.all([
    supabase.from('bingo_team_cards').select('team_id, cells').eq('run_id', runId),
    supabase
      .from('submissions')
      .select('id, team_id, media_url, status')
      .eq('event_id', eventId)
      .eq('game_id', gameId)
      .eq('media_type', 'bingo')
      .eq('status', 'pending'),
  ])

  if (!cards?.length) return

  for (const row of cards) {
    const cells = row.cells as BingoCell[]
    const correctIndex = cells.findIndex((c) => c.trackId === trackId)
    const teamSubs = (subs ?? []).filter((s) => s.team_id === row.team_id)

    for (const sub of teamSubs) {
      const markedIndex = Number(sub.media_url)
      if (Number.isNaN(markedIndex)) continue

      if (markedIndex === correctIndex) {
        await supabase
          .from('submissions')
          .update({ status: 'approved', points_awarded: 1 })
          .eq('id', sub.id)
      } else {
        await supabase.from('submissions').update({ status: 'rejected' }).eq('id', sub.id)
      }
    }
  }
}
