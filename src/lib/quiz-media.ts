import type { QuizMediaKind, QuizQuestion } from '@/types/game-config'

/**
 * What a question actually carries, reading the old shape when the new one is
 * absent.
 *
 * Questions written before media existed only have `photoUrl`. Rather than
 * migrating that data, which would mean rewriting every quiz's config, the
 * reader treats a bare photoUrl as a photo question. New questions write
 * mediaKind and mediaUrl and never touch photoUrl.
 */
export function questionMedia(question: QuizQuestion | null | undefined): {
  kind: QuizMediaKind
  url: string | null
} {
  // A missing question is a real state, not a bug to crash on: the live panel
  // indexes into the question list with event_state.current_question_index, and
  // that can point at nothing when a quiz has no usable questions yet or the
  // index runs past the end. Every other read of the current question already
  // uses optional chaining; this one did not, so it took the whole participant
  // screen down with "Cannot read properties of undefined (reading
  // 'mediaKind')" the moment a facilitator opened such a quiz stage.
  if (!question) return { kind: 'none', url: null }
  if (question.mediaKind) {
    return { kind: question.mediaKind, url: question.mediaUrl ?? null }
  }
  if (question.photoUrl?.trim()) {
    return { kind: 'photo', url: question.photoUrl }
  }
  return { kind: 'none', url: null }
}

/** True when the kind is one the organiser uploads rather than links. */
export function isUploadedMedia(kind: QuizMediaKind): boolean {
  return kind === 'photo' || kind === 'audio'
}

/** Accept attribute for the file input behind an uploaded kind. */
export function mediaAccept(kind: QuizMediaKind): string {
  return kind === 'audio' ? 'audio/*' : 'image/*'
}

/** The four corner colours, falling back to a neutral set when unset. */
export const DEFAULT_QUIZ_BACKGROUND: [string, string, string, string] = [
  '#2f3037',
  '#4a4d59',
  '#6b6f7e',
  '#1f2126',
]

export function quizBackgroundGradient(
  colors: [string, string, string, string] | undefined,
): string {
  const [a, b, c, d] = colors ?? DEFAULT_QUIZ_BACKGROUND
  // One colour pinned to each corner, which is what a four-stop background
  // needs; a single linear gradient can only span two.
  return [
    `radial-gradient(at 0% 0%, ${a} 0px, transparent 55%)`,
    `radial-gradient(at 100% 0%, ${b} 0px, transparent 55%)`,
    `radial-gradient(at 100% 100%, ${c} 0px, transparent 55%)`,
    `radial-gradient(at 0% 100%, ${d} 0px, transparent 55%)`,
  ].join(', ')
}
