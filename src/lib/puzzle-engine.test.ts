import { describe, expect, it } from 'vitest'

import {
  CROSSWORD_SIZE,
  crosswordScore,
  detectCrosswordRuns,
  matchingScore,
  parsePuzzleProgress,
  seededPuzzleShuffle,
  validatePuzzleConfig,
  wordleFeedback,
  wordleKeyStates,
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

describe('wordleKeyStates', () => {
  it('keeps the best state seen for each letter across all guesses', () => {
    const states = wordleKeyStates([
      { word: 'RATE', feedback: ['absent', 'correct', 'present', 'absent'] },
      { word: 'CARS', feedback: ['absent', 'present', 'absent', 'correct'] },
    ])
    expect(states).toEqual({
      r: 'absent',
      a: 'correct',
      t: 'present',
      e: 'absent',
      c: 'absent',
      s: 'correct',
    })
  })

  it('returns an empty map for no guesses', () => {
    expect(wordleKeyStates([])).toEqual({})
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
    // Two pairs that cross each other but not each other's pair. The message
    // names the stranded words, since "every word must cross another" is true
    // of this grid and still leaves it in two pieces.
    const error = validateCrosswordWords(words)
    expect(error).toMatch(/separate pieces/i)
    expect(error).toContain('CD')
    expect(error).toContain('CE')
  })

  it('numbers clues in top-left scan order', () => {
    const layout = buildCrosswordLayout(crossedWords)
    const byId = new Map(layout.clues.map((c) => [c.id, c]))
    expect(byId.get('a')?.number).toBe(1)
    expect(byId.get('b')?.number).toBe(1)
    expect(byId.get('c')?.number).toBe(2)
    expect(layout.cells.length).toBe(12)
  })

})

describe('crossword grid size', () => {
  it('is 6', () => {
    expect(CROSSWORD_SIZE).toBe(6)
  })
})

describe('crossword scoring', () => {
  it('awards full points at or under five minutes with no hints', () => {
    expect(crosswordScore(100, 299, 0)).toBe(100)
    expect(crosswordScore(100, 300, 0)).toBe(100)
  })
  it('deducts five percent per thirty-second block over five minutes', () => {
    expect(crosswordScore(100, 310, 0)).toBe(95) // 5:10 -> 1 block
    expect(crosswordScore(100, 330, 0)).toBe(95) // 5:30 -> 1 block
    expect(crosswordScore(100, 345, 0)).toBe(90) // 5:45 -> 2 blocks
    expect(crosswordScore(100, 360, 0)).toBe(90) // 6:00 -> 2 blocks
  })
  it('deducts ten percent per hint', () => {
    expect(crosswordScore(100, 200, 1)).toBe(90)
    expect(crosswordScore(100, 200, 3)).toBe(70)
  })
  it('floors at ten percent of max', () => {
    expect(crosswordScore(100, 6000, 3)).toBe(10)
  })
})

describe('crossword run detection', () => {
  it('finds every across and down run of two or more letters', () => {
    const letters = new Map<string, string>([
      ['0-0', 'c'], ['0-1', 'a'], ['0-2', 't'],
      ['1-0', 'o'], ['2-0', 'w'],
    ])
    const runs = detectCrosswordRuns(letters, new Set())
    expect(runs).toEqual([
      { row: 0, col: 0, direction: 'across', answer: 'cat' },
      { row: 0, col: 0, direction: 'down', answer: 'cow' },
    ])
  })
  it('breaks runs on blocked cells and ignores single letters', () => {
    const letters = new Map<string, string>([
      ['0-0', 'a'], ['0-1', 't'], ['0-3', 'x'],
    ])
    const runs = detectCrosswordRuns(letters, new Set(['0-2']))
    expect(runs).toEqual([{ row: 0, col: 0, direction: 'across', answer: 'at' }])
  })
})

describe('crossword progress parsing', () => {
  it('reads hints, revealed cells, solved words and start time', () => {
    const parsed = parsePuzzleProgress({
      puzzleType: 'crossword',
      hintsUsed: 2,
      revealedCells: { '0-0': 'C', '1-1': 'x' },
      solvedWordIds: ['a', 'b'],
      startedAt: '2026-07-19T10:00:00Z',
    })
    expect(parsed.hintsUsed).toBe(2)
    expect(parsed.revealedCells).toEqual({ '0-0': 'C', '1-1': 'x' })
    expect(parsed.solvedWordIds).toEqual(['a', 'b'])
    expect(parsed.startedAt).toBe('2026-07-19T10:00:00Z')
  })
  it('defaults the new fields', () => {
    const parsed = parsePuzzleProgress({ puzzleType: 'crossword' })
    expect(parsed.hintsUsed).toBe(0)
    expect(parsed.revealedCells).toEqual({})
    expect(parsed.solvedWordIds).toEqual([])
    expect(parsed.startedAt).toBeNull()
  })
})
