import { QuizAudioPlayer } from '@/components/live/QuizAudioPlayer'
import { QuizVideoPlayer } from '@/components/live/QuizVideoPlayer'
import { questionMedia } from '@/lib/quiz-media'
import type { QuizQuestion } from '@/types/game-config'

/**
 * What a question carries, in a box locked to 16:9 whatever that is.
 *
 * The shape never changes with the content: a photo fills the box, a video
 * plays inside it, and audio draws its waveform in it. The question above and
 * the answers below therefore sit in the same place on every question, which
 * is the point — nothing on this screen may move mid-round.
 *
 * Ideal photo size is 1600 x 900; anything else is filled to the box.
 */
export function QuizQuestionMedia({
  question,
  accentColor,
  textColor,
}: {
  question: QuizQuestion
  accentColor: string
  textColor: string
}) {
  const { kind, url } = questionMedia(question)
  if (!url || kind === 'none') return null

  return (
    <div className="mx-auto aspect-video max-h-full w-full max-w-md">
      {kind === 'photo' ? (
        <img
          src={url}
          alt=""
          className="size-full rounded-xl object-cover shadow-lg"
        />
      ) : kind === 'video' ? (
        <QuizVideoPlayer url={url} accentColor={accentColor} />
      ) : (
        <QuizAudioPlayer url={url} accentColor={accentColor} textColor={textColor} />
      )}
    </div>
  )
}
