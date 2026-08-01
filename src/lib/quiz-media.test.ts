import { describe, expect, it } from 'vitest'

import { questionMedia, quizBackgroundGradient } from '@/lib/quiz-media'
import type { QuizQuestion } from '@/types/game-config'

const base: QuizQuestion = {
  id: 'q1',
  text: 'Who is this?',
  answers: [],
  correctAnswerId: '',
}

describe('questionMedia', () => {
  it('reads an old photo-only question as a photo question', () => {
    // The case that must not break: quizzes written before media existed.
    expect(questionMedia({ ...base, photoUrl: 'https://x/y.png' })).toEqual({
      kind: 'photo',
      url: 'https://x/y.png',
    })
  })

  it('prefers the new shape when both are present', () => {
    expect(
      questionMedia({
        ...base,
        photoUrl: 'https://old/photo.png',
        mediaKind: 'audio',
        mediaUrl: 'https://new/clip.mp3',
      }),
    ).toEqual({ kind: 'audio', url: 'https://new/clip.mp3' })
  })

  it('treats a question with nothing attached as none', () => {
    expect(questionMedia(base)).toEqual({ kind: 'none', url: null })
    expect(questionMedia({ ...base, photoUrl: '   ' })).toEqual({ kind: 'none', url: null })
  })

  it('keeps an explicit none even when an old photo lingers', () => {
    expect(questionMedia({ ...base, photoUrl: 'https://x/y.png', mediaKind: 'none' })).toEqual({
      kind: 'none',
      url: null,
    })
  })
})

describe('quizBackgroundGradient', () => {
  it('pins one colour to each corner', () => {
    const css = quizBackgroundGradient(['#111111', '#222222', '#333333', '#444444'])
    expect(css).toContain('at 0% 0%, #111111')
    expect(css).toContain('at 100% 0%, #222222')
    expect(css).toContain('at 100% 100%, #333333')
    expect(css).toContain('at 0% 100%, #444444')
  })

  it('falls back when no colours are set', () => {
    expect(quizBackgroundGradient(undefined)).toContain('radial-gradient')
  })
})
