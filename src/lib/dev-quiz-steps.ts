import type { QuizQuestion } from '@/types/game-config'
import type { Tables } from '@/types/helpers'

/**
 * The screens of a quiz stage, in the order a facilitator produces them, for
 * the development-only quiz driver (?devbar=1). See DevQuizBar.
 */
export type DevQuizStep = {
  label: string
  quiz_state: string
  question_index: number
  correct_answer_id: string | null
  /** Event-level winner reveal, which comes after the quiz has ended. */
  winner_reveal_stage: number
}

/** Every screen of the quiz stage, start to finish. */
export function devQuizSteps(questions: QuizQuestion[]): DevQuizStep[] {
  const step = (
    label: string,
    quiz_state: string,
    question_index: number,
    correct_answer_id: string | null = null,
    winner_reveal_stage = 0,
  ): DevQuizStep => ({ label, quiz_state, question_index, correct_answer_id, winner_reveal_stage })

  const steps: DevQuizStep[] = [step('Get ready', 'waiting', 0)]

  let previousRound: string | null | undefined
  questions.forEach((question, index) => {
    // A round intro plays each time the questions cross into a new round.
    if (question.roundId && question.roundId !== previousRound) {
      steps.push(step('Round intro', 'round_intro', index))
      previousRound = question.roundId
    }
    steps.push(step(`Q${index + 1} question`, 'active', index))
    steps.push(step(`Q${index + 1} answer`, 'revealed', index, question.correctAnswerId ?? null))
  })

  const last = Math.max(0, questions.length - 1)
  steps.push(step('Quiz scores', 'results', last))
  steps.push(step('Quiz ended', 'ended', last))
  steps.push(step('Runners up', 'ended', last, null, 1))
  steps.push(step('Winner', 'ended', last, null, 2))
  return steps
}

/** Which step the current event state corresponds to, as a starting point. */
export function devQuizStepIndex(
  steps: DevQuizStep[],
  state: Tables<'event_state'>,
): number {
  const found = steps.findIndex(
    (step) =>
      step.quiz_state === state.quiz_state &&
      step.question_index === state.current_question_index,
  )
  return found === -1 ? 0 : found
}
