import { describe, it, expect } from 'vitest'

import {
  applyLocalCrosswordCheck,
  applyLocalCrosswordHint,
  applyLocalMatch,
  applyLocalWordleGuess,
  crosswordWordsFromKey,
  freshLocalPuzzleProgress,
  matchingPairsFromKey,
  wordleAnswerFromKey,
} from './puzzle-local'
import type { CrosswordWord } from './scoring'

describe('answer-key readers', () => {
  it('wordle: a usable answer or null', () => {
    expect(wordleAnswerFromKey({ puzzle_wordle_answer: ' RADIO ' })).toBe('RADIO')
    expect(wordleAnswerFromKey({ puzzle_wordle_answer: '  ' })).toBeNull()
    expect(wordleAnswerFromKey({})).toBeNull()
    expect(wordleAnswerFromKey(null)).toBeNull()
  })

  it('matching: the whole shape must hold or the key is unusable', () => {
    const good = [{ id: 'p1', leftId: 'l1', rightId: 'r1', left: 'A', right: 'B' }]
    expect(matchingPairsFromKey({ puzzle_matching_pairs: good })).toEqual(good)
    expect(matchingPairsFromKey({ puzzle_matching_pairs: [{ id: 'p1' }] })).toBeNull()
    expect(matchingPairsFromKey({ puzzle_matching_pairs: [] })).toBeNull()
    expect(matchingPairsFromKey({})).toBeNull()
  })

  it('crossword: the whole shape must hold or the key is unusable', () => {
    const good = [{ id: 'w1', answer: 'cat', row: 0, col: 0, direction: 'across' }]
    expect(crosswordWordsFromKey({ puzzle_crossword_words: good })).toEqual(good)
    expect(crosswordWordsFromKey({ puzzle_crossword_words: [{ id: 'w1' }] })).toBeNull()
    expect(crosswordWordsFromKey({})).toBeNull()
  })
})

describe('applyLocalWordleGuess', () => {
  it('accumulates guesses and completes on the answer with server-formula points', () => {
    const one = applyLocalWordleGuess(freshLocalPuzzleProgress('wordle'), 'RADIO', 'AUDIO', 100)
    expect(one.attempts).toBe(1)
    expect(one.completed).toBe(false)
    expect(one.pointsAwarded).toBeNull()
    expect(one.guesses).toEqual([
      { word: 'AUDIO', feedback: ['present', 'absent', 'correct', 'correct', 'correct'] },
    ])
    const two = applyLocalWordleGuess(one, 'RADIO', 'radio', 100)
    expect(two.completed).toBe(true)
    expect(two.attempts).toBe(2)
    // puzzle_wordle_points(100, 2) = round(100 * 0.9)
    expect(two.pointsAwarded).toBe(90)
  })

  it('rejects a wrong-length guess like the server does', () => {
    expect(() =>
      applyLocalWordleGuess(freshLocalPuzzleProgress('wordle'), 'RADIO', 'CAT', 100),
    ).toThrow()
  })

  it('is a no-op once completed', () => {
    const done = { ...freshLocalPuzzleProgress('wordle'), completed: true }
    expect(applyLocalWordleGuess(done, 'RADIO', 'RADIO', 100)).toBe(done)
  })
})

describe('applyLocalMatch', () => {
  const pairs = [
    { id: 'p1', leftId: 'l1', rightId: 'r1', left: 'A', right: '1' },
    { id: 'p2', leftId: 'l2', rightId: 'r2', left: 'B', right: '2' },
  ]

  it('tracks wrong and correct matches and completes with server-formula points', () => {
    const wrong = applyLocalMatch(freshLocalPuzzleProgress('matching'), pairs, 'l1', 'r2', 100)
    expect(wrong.lastMatchCorrect).toBe(false)
    expect(wrong.wrongMatches).toBe(1)
    expect(wrong.attempts).toBe(1)
    expect(wrong.matchedLeftIds).toEqual([])

    const first = applyLocalMatch(wrong, pairs, 'l1', 'r1', 100)
    expect(first.lastMatchCorrect).toBe(true)
    expect(first.matchedLeftIds).toEqual(['l1'])
    expect(first.matchedRightIds).toEqual(['r1'])
    expect(first.completed).toBe(false)

    const done = applyLocalMatch(first, pairs, 'l2', 'r2', 100)
    expect(done.completed).toBe(true)
    expect(done.attempts).toBe(3)
    // puzzle_matching_points(100, 1) = round(100 * 0.95)
    expect(done.pointsAwarded).toBe(95)
  })

  it('re-submitting a matched side is a counted-nowhere no-op', () => {
    const first = applyLocalMatch(freshLocalPuzzleProgress('matching'), pairs, 'l1', 'r1', 100)
    const again = applyLocalMatch(first, pairs, 'l1', 'r2', 100)
    expect(again.lastMatchCorrect).toBe(true)
    expect(again.attempts).toBe(first.attempts)
    expect(again.wrongMatches).toBe(first.wrongMatches)
  })
})

describe('crossword local drivers', () => {
  // CAT across at row 0, COW down sharing the C at 0-0.
  const words: CrosswordWord[] = [
    { id: 'across', answer: 'cat', row: 0, col: 0, direction: 'across' },
    { id: 'down', answer: 'cow', row: 0, col: 0, direction: 'down' },
  ]

  it('check saves the fill, recomputes solved words, and completes on a full grid', () => {
    const now = Date.now()
    const start = {
      ...freshLocalPuzzleProgress('crossword'),
      startedAt: new Date(now - 100_000).toISOString(),
    }
    const partial = applyLocalCrosswordCheck(start, words, { '0-0': 'C', '0-1': 'A', '0-2': 'T' }, 100, now)
    expect(partial.solvedWordIds).toEqual(['across'])
    expect(partial.completed).toBe(false)

    const full = applyLocalCrosswordCheck(
      start,
      words,
      { '0-0': 'C', '0-1': 'A', '0-2': 'T', '1-0': 'O', '2-0': 'W' },
      100,
      now,
    )
    expect(full.completed).toBe(true)
    expect(full.solveSeconds).toBe(100)
    // Under 5 minutes with no hints: full points.
    expect(full.pointsAwarded).toBe(100)
  })

  it('hint reveals one wrong-or-empty cell per unsolved word, crossings once', () => {
    const start = freshLocalPuzzleProgress('crossword')
    const one = applyLocalCrosswordHint(start, words, {})
    // Both words want 0-0 first; the shared cell is granted once, and the
    // crossing word moves on to its own next missing letter.
    expect(one.revealedCells).toEqual({ '0-0': 'C', '1-0': 'O' })
    expect(one.filledCells).toEqual({ '0-0': 'C', '1-0': 'O' })
    expect(one.hintsUsed).toBe(1)

    const two = applyLocalCrosswordHint(one, words, one.filledCells)
    // The revealed cells are now correct, so each word moves further along.
    expect(two.revealedCells).toEqual({ '0-0': 'C', '1-0': 'O', '0-1': 'A', '2-0': 'W' })
    expect(two.hintsUsed).toBe(2)
  })

  it('a hint that finishes a word turns it solved immediately', () => {
    const start = freshLocalPuzzleProgress('crossword')
    const next = applyLocalCrosswordHint(start, words, { '0-1': 'A', '0-2': 'T', '1-0': 'O', '2-0': 'W' })
    expect(next.solvedWordIds.sort()).toEqual(['across', 'down'])
  })

  it('hints cap at 3', () => {
    const capped = { ...freshLocalPuzzleProgress('crossword'), hintsUsed: 3 }
    expect(applyLocalCrosswordHint(capped, words, {})).toBe(capped)
  })
})
