import { questionMedia } from '@/lib/quiz-media'
import type { QuizQuestion } from '@/types/game-config'

/**
 * How long a question is open for.
 *
 * A question carrying a photo, a video or a clip asks more of a team than a
 * written one: they have to look or listen before they can even start
 * thinking. So the organiser's time is doubled for those, and for video and
 * audio the length of the media is added on top, since that part of the time
 * is spent watching rather than deciding. Nothing to set up: it follows from
 * what the question carries.
 */
export function quizQuestionSeconds(
  baseSeconds: number,
  question: QuizQuestion | undefined,
): number {
  const base = Math.max(1, Math.round(baseSeconds))
  if (!question) return base

  const { kind } = questionMedia(question)
  if (kind === 'none') return base
  if (kind === 'photo') return base * 2

  const media = Math.max(0, Math.round(question.mediaDurationSeconds ?? 0))
  return base * 2 + media
}
