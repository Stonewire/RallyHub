import { applySubmissionPoints } from '@/lib/apply-submission-points'
import { parseBingoBonusSubmission } from '@/lib/bingo-submission-url'
import { publishLiveBundleReload } from '@/lib/live-broadcast'
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

  const errors: string[] = []
  for (const sub of subs ?? []) {
    const { answerId } = parseBingoBonusSubmission(sub.media_url)
    if (answerId === correctAnswerId) {
      const points = 2
      const { error: approveErr } = await supabase
        .from('submissions')
        .update({ status: 'approved', points_awarded: points })
        .eq('id', sub.id)
      if (approveErr) {
        errors.push(approveErr.message)
        continue
      }
      await applySubmissionPoints(sub.team_id, points, eventId)
    } else {
      const { error: rejectErr } = await supabase
        .from('submissions')
        .update({ status: 'rejected' })
        .eq('id', sub.id)
      if (rejectErr) errors.push(rejectErr.message)
    }
  }
  if (errors.length > 0) {
    throw new Error(`Bingo bonus scoring DB errors: ${errors.join('; ')}`)
  }

  await publishLiveBundleReload(eventId)
}
