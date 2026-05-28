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
    .select('id, media_url, status')
    .eq('event_id', eventId)
    .eq('game_id', gameId)
    .eq('media_type', mediaType)
    .eq('status', 'pending')

  for (const sub of subs ?? []) {
    if (sub.media_url === correctAnswerId) {
      await supabase
        .from('submissions')
        .update({ status: 'approved', points_awarded: 2 })
        .eq('id', sub.id)
    } else {
      await supabase.from('submissions').update({ status: 'rejected' }).eq('id', sub.id)
    }
  }
}
