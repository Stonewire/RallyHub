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
  it('validates crossword configs through the word validator', () => {
    expect(validatePuzzleConfig({ puzzle_type: 'crossword' })).toMatch(/at least 2/i)
    expect(
      validatePuzzleConfig({
        puzzle_type: 'crossword',
        puzzle_crossword_words: [
          { id: 'a', answer: 'RALLY', clue: 'Our product', row: 0, col: 0, direction: 'across' },
          { id: 'b', answer: 'ROBOT', clue: 'Machine helper', row: 0, col: 0, direction: 'down' },
        ],
      }),
    ).toMatch(/layout is missing/i)
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

import {
  buildCrosswordLayout,
  crosswordCellLetters,
  crosswordScore,
  validateCrosswordWords,
} from '@/lib/puzzle-engine'
import type { PuzzleCrosswordWord } from '@/types/game-config'

const crossedWords: PuzzleCrosswordWord[] = [
  { id: 'a', answer: 'RALLY', clue: 'Our product', row: 0, col: 0, direction: 'across' },
  { id: 'b', answer: 'ROBOT', clue: 'Machine helper', row: 0, col: 0, direction: 'down' },
  { id: 'c', answer: 'TEAM', clue: 'Group of players', row: 4, col: 0, direction: 'across' },
]

describe('crossword engine', () => {
  it('maps letters and finds no conflicts on a valid overlap', () => {
    const { letters, conflicts } = crosswordCellLetters(crossedWords)
    expect(conflicts.size).toBe(0)
    expect(letters.get('0-0')).toBe('r')
    expect(letters.get('4-0')).toBe('t')
  })

  it('flags conflicting overlap letters', () => {
    const words: PuzzleCrosswordWord[] = [
      { id: 'a', answer: 'RALLY', clue: 'x', row: 0, col: 0, direction: 'across' },
      { id: 'b', answer: 'BINGO', clue: 'x', row: 0, col: 0, direction: 'down' },
    ]
    const { conflicts } = crosswordCellLetters(words)
    expect(conflicts.has('0-0')).toBe(true)
  })

  it('accepts a connected valid puzzle', () => {
    expect(validateCrosswordWords(crossedWords)).toBeNull()
  })

  it('rejects fewer than 2 words', () => {
    expect(validateCrosswordWords(crossedWords.slice(0, 1))).toMatch(/at least 2/i)
  })

  it('rejects out-of-bounds words', () => {
    const words: PuzzleCrosswordWord[] = [
      { id: 'a', answer: 'RALLY', clue: 'x', row: 0, col: 2, direction: 'across' },
      { id: 'b', answer: 'ROBOT', clue: 'x', row: 0, col: 2, direction: 'down' },
    ]
    expect(validateCrosswordWords(words)).toMatch(/fit/i)
  })

  it('rejects missing clues', () => {
    const words = crossedWords.map((w) => (w.id === 'c' ? { ...w, clue: ' ' } : w))
    expect(validateCrosswordWords(words)).toMatch(/clue/i)
  })

  it('rejects disconnected islands', () => {
    const words: PuzzleCrosswordWord[] = [
      { id: 'a', answer: 'AB', clue: 'x', row: 0, col: 0, direction: 'across' },
      { id: 'b', answer: 'AB', clue: 'x', row: 0, col: 0, direction: 'down' },
      { id: 'c', answer: 'CD', clue: 'x', row: 3, col: 3, direction: 'across' },
      { id: 'd', answer: 'CE', clue: 'x', row: 3, col: 3, direction: 'down' },
    ]
    expect(validateCrosswordWords(words)).toMatch(/cross/i)
  })

  it('numbers clues in top-left scan order', () => {
    const layout = buildCrosswordLayout(crossedWords)
    const byId = new Map(layout.clues.map((c) => [c.id, c]))
    expect(byId.get('a')?.number).toBe(1)
    expect(byId.get('b')?.number).toBe(1)
    expect(byId.get('c')?.number).toBe(2)
    expect(layout.cells.length).toBe(12)
  })

  it('scores full points inside 2 minutes', () => {
    expect(crosswordScore(100, 0)).toBe(100)
    expect(crosswordScore(100, 119)).toBe(100)
    expect(crosswordScore(100, 179)).toBe(100)
  })

  it('decays 10% of remaining per full extra minute', () => {
    expect(crosswordScore(100, 180)).toBe(90)
    expect(crosswordScore(100, 240)).toBe(81)
    expect(crosswordScore(100, 300)).toBe(73)
  })

  it('clamps at the 25% floor', () => {
    expect(crosswordScore(100, 60 * 60)).toBe(25)
  })
})
