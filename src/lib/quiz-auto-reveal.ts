export type QuizAutoRevealState = {
  quizState: string
  timerSeconds: number
  timerRunning: boolean
  allAnswered: boolean
}

/**
 * Decide from authoritative event state, not the animated timer display. The
 * display can still be zero for one render when a new question starts after a
 * timeout, which must not consume that question's one-shot reveal guard.
 */
export function shouldAutoRevealQuizQuestion({
  quizState,
  timerSeconds,
  timerRunning,
  allAnswered,
}: QuizAutoRevealState): boolean {
  if (quizState !== 'active') return false
  return allAnswered || (!timerRunning && timerSeconds <= 0)
}
