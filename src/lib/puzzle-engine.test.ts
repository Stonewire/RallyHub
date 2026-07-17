import { describe, expect, it } from 'vitest'

import {
  matchingScore,
  seededPuzzleShuffle,
  validatePuzzleConfig,
  wordleFeedback,
  wordleScore,
} from '@/lib/puzzle-engine'

describe('puzzle scoring', () => {
  it('uses the preserved Wordle remaining-score curve and ten percent floor', () => {
    expect([1, 2, 3, 4, 5, 6].map((attempt) => wordleScore(100, attempt))).toEqual([
      100, 90, 81, 73, 66, 59,
    ])
    expect(wordleScore(100, 100)).toBe(10)
  })

  it('deducts five percent for Matching mistakes with a 25 percent floor', () => {
    expect(matchingScore(100, 0)).toBe(100)
    expect(matchingScore(100, 3)).toBe(85)
    expect(matchingScore(100, 99)).toBe(25)
  })
})

describe('Wordle feedback', () => {
  it('consumes duplicate letters only once', () => {
    expect(wordleFeedback('APPLE', 'ALLEY')).toEqual([
      'correct', 'present', 'absent', 'present', 'absent',
    ])
  })

  it('supports Unicode letters', () => {
    expect(wordleFeedback('ÉTÉ', 'ÉTÉ')).toEqual(['correct', 'correct', 'correct'])
  })
})

describe('puzzle configuration', () => {
  it('keeps Crossword unavailable', () => {
    expect(validatePuzzleConfig({ puzzle_type: 'crossword' })).toMatch(/coming soon/i)
  })

  it('rejects duplicate Matching values within a column', () => {
    expect(
      validatePuzzleConfig({
        puzzle_type: 'matching',
        puzzle_matching_pairs: [
          { id: '1', leftId: 'l1', rightId: 'r1', left: 'France', right: 'Paris' },
          { id: '2', leftId: 'l2', rightId: 'r2', left: 'france', right: 'Lyon' },
        ],
      }),
    ).toMatch(/unique/i)
  })

  it('shuffles consistently per team while preserving every item', () => {
    const source = ['a', 'b', 'c', 'd', 'e']
    expect(seededPuzzleShuffle(source, 'team-1')).toEqual(seededPuzzleShuffle(source, 'team-1'))
    expect(seededPuzzleShuffle(source, 'team-1').sort()).toEqual(source)
  })
})
