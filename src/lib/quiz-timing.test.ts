import { describe, expect, it } from 'vitest'

import { quizQuestionSeconds } from '@/lib/quiz-timing'
import type { QuizQuestion } from '@/types/game-config'

function question(patch: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    id: 'q1',
    text: 'Question',
    answers: [],
    correctAnswerId: '',
    ...patch,
  }
}

describe('quizQuestionSeconds', () => {
  it('leaves a written question on the organiser’s time', () => {
    expect(quizQuestionSeconds(10, question())).toBe(10)
    expect(quizQuestionSeconds(10, question({ mediaKind: 'none' }))).toBe(10)
  })

  it('doubles the time for a photo', () => {
    expect(
      quizQuestionSeconds(10, question({ mediaKind: 'photo', mediaUrl: 'p.jpg' })),
    ).toBe(20)
  })

  it('doubles the time and adds the clip for video and audio', () => {
    expect(
      quizQuestionSeconds(
        10,
        question({ mediaKind: 'video', mediaUrl: 'v.mp4', mediaDurationSeconds: 5 }),
      ),
    ).toBe(25)
    expect(
      quizQuestionSeconds(
        10,
        question({ mediaKind: 'audio', mediaUrl: 'a.mp3', mediaDurationSeconds: 12 }),
      ),
    ).toBe(32)
  })

  it('still doubles when the clip length is unknown', () => {
    expect(
      quizQuestionSeconds(10, question({ mediaKind: 'video', mediaUrl: 'v.mp4' })),
    ).toBe(20)
  })

  it('reads the legacy photo field as a photo question', () => {
    expect(quizQuestionSeconds(10, question({ photoUrl: 'old.jpg' }))).toBe(20)
  })
})
