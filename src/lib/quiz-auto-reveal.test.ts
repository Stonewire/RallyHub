import { describe, expect, it } from 'vitest'

import {
  QUIZ_ANSWER_CHANGE_SECONDS,
  shouldAutoRevealQuizQuestion,
} from '@/lib/quiz-auto-reveal'

describe('shouldAutoRevealQuizQuestion', () => {
  it('does not consume the next question reveal while its timer is running', () => {
    expect(
      shouldAutoRevealQuizQuestion({
        quizState: 'active',
        timerSeconds: 20,
        timerRunning: true,
        allAnswered: false,
        secondsSinceLastAnswer: 0,
      }),
    ).toBe(false)
  })

  it('waits out the change window after the last team answers', () => {
    expect(
      shouldAutoRevealQuizQuestion({
        quizState: 'active',
        timerSeconds: 18,
        timerRunning: true,
        allAnswered: true,
        secondsSinceLastAnswer: QUIZ_ANSWER_CHANGE_SECONDS - 1,
      }),
    ).toBe(false)
  })

  it('reveals once every team has answered and locked', () => {
    expect(
      shouldAutoRevealQuizQuestion({
        quizState: 'active',
        timerSeconds: 12,
        timerRunning: true,
        allAnswered: true,
        secondsSinceLastAnswer: QUIZ_ANSWER_CHANGE_SECONDS,
      }),
    ).toBe(true)
  })

  it('reveals when the authoritative timer has stopped at zero', () => {
    expect(
      shouldAutoRevealQuizQuestion({
        quizState: 'active',
        timerSeconds: 0,
        timerRunning: false,
        allAnswered: false,
        secondsSinceLastAnswer: 0,
      }),
    ).toBe(true)
  })

  it('does not re-run after the question is already revealed', () => {
    expect(
      shouldAutoRevealQuizQuestion({
        quizState: 'revealed',
        timerSeconds: 0,
        timerRunning: false,
        allAnswered: true,
        secondsSinceLastAnswer: 30,
      }),
    ).toBe(false)
  })
})
