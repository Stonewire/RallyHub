/**
 * A team keeps this long to change its mind after answering, counted from
 * their first answer to the question. The participant screen runs the same
 * window locally; this is the facilitator's copy of it.
 */
export const QUIZ_ANSWER_CHANGE_SECONDS = 5

export type QuizAutoRevealState = {
  quizState: string
  timerSeconds: number
  timerRunning: boolean
  allAnswered: boolean
  /**
   * Age of the newest answer to this question. Everyone having answered is not
   * enough on its own: the last team still holds its change window, and
   * revealing inside that window takes back a choice they were offered.
   */
  secondsSinceLastAnswer: number
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
  secondsSinceLastAnswer,
}: QuizAutoRevealState): boolean {
  if (quizState !== 'active') return false
  if (!timerRunning && timerSeconds <= 0) return true
  return allAnswered && secondsSinceLastAnswer >= QUIZ_ANSWER_CHANGE_SECONDS
}
