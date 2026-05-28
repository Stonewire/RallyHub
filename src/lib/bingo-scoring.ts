import { applySubmissionPoints } from '@/lib/apply-submission-points'
import type { BingoCell } from '@/lib/bingo-engine'
import { BINGO_CLAIM_MARK } from '@/lib/bingo-claims'
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
      if (sub.media_url === BINGO_CLAIM_MARK) continue
      const markedIndex = Number(sub.media_url)
      if (Number.isNaN(markedIndex)) continue

      if (markedIndex === correctIndex) {
        const points = 1
        await supabase
          .from('submissions')
          .update({ status: 'approved', points_awarded: points })
          .eq('id', sub.id)
        await applySubmissionPoints(row.team_id, points)
      } else {
        await supabase.from('submissions').update({ status: 'rejected' }).eq('id', sub.id)
      }
    }
  }
}
