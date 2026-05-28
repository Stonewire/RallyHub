import { applySubmissionPoints } from '@/lib/apply-submission-points'
import { parseBingoBonusSubmission } from '@/lib/bingo-submission-url'
import { bingoBonusMediaType } from '@/lib/live-event'
import { supabase } from '@/lib/supabase'

/** Approve/reject bonus MCQ submissions after facilitator reveals answers. */
export async function scoreBingoBonusRound(params: {
  eventId: string
  gameId: string
  challengeId: string
  correctAnswerId: string
}): Promise<void> {
  const { eventId, gameId, challengeId, correctAnswerId } = params
  const mediaType = bingoBonusMediaType(challengeId)

  const { data: subs } = await supabase
    .from('submissions')
    .select('id, team_id, media_url, status')
    .eq('event_id', eventId)
    .eq('game_id', gameId)
    .eq('media_type', mediaType)
    .eq('status', 'pending')

  for (const sub of subs ?? []) {
    const { answerId } = parseBingoBonusSubmission(sub.media_url)
    if (answerId === correctAnswerId) {
      const points = 2
      await supabase
        .from('submissions')
        .update({ status: 'approved', points_awarded: points })
        .eq('id', sub.id)
      await applySubmissionPoints(sub.team_id, points)
    } else {
      await supabase.from('submissions').update({ status: 'rejected' }).eq('id', sub.id)
    }
  }
}
