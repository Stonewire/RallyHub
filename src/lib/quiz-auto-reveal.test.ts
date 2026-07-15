import { describe, expect, it } from 'vitest'

import { shouldAutoRevealQuizQuestion } from '@/lib/quiz-auto-reveal'

describe('shouldAutoRevealQuizQuestion', () => {
  it('does not consume the next question reveal while its timer is running', () => {
    expect(
      shouldAutoRevealQuizQuestion({
        quizState: 'active',
        timerSeconds: 20,
        timerRunning: true,
        allAnswered: false,
      }),
    ).toBe(false)
  })

  it('reveals as soon as every named team has answered', () => {
    expect(
      shouldAutoRevealQuizQuestion({
        quizState: 'active',
        timerSeconds: 18,
        timerRunning: true,
        allAnswered: true,
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
      }),
    ).toBe(false)
  })
})
