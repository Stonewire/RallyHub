import { describe, it, expect } from 'vitest'

import type { OutboxItem } from './outbox'
import {
  applyLocalCrosswordCheck,
  applyLocalCrosswordHint,
  applyLocalMatch,
  applyLocalWordleGuess,
  crosswordWordsFromKey,
  freshLocalPuzzleProgress,
  matchingPairsFromKey,
  queuedPuzzleSubmissionRow,
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

  it('hint reveals exactly ONE letter, preferring a crossing cell (server 20260720 algorithm)', () => {
    const start = freshLocalPuzzleProgress('crossword')
    const one = applyLocalCrosswordHint(start, words, {})
    // 0-0 is shared by both unsolved words, so it wins over every other cell.
    expect(one.revealedCells).toEqual({ '0-0': 'C' })
    expect(one.filledCells).toEqual({ '0-0': 'C' })
    expect(one.hintsUsed).toBe(1)

    const two = applyLocalCrosswordHint(one, words, one.filledCells)
    // No crossing candidates remain; the lowest "row-col" key wins.
    expect(two.revealedCells).toEqual({ '0-0': 'C', '0-1': 'A' })
    expect(two.hintsUsed).toBe(2)
  })

  it('a hint with nothing to reveal burns no hint', () => {
    const start = freshLocalPuzzleProgress('crossword')
    const full = { '0-0': 'C', '0-1': 'A', '0-2': 'T', '1-0': 'O', '2-0': 'W' }
    const after = applyLocalCrosswordHint(start, words, full)
    expect(after).toBe(start)
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

describe('queuedPuzzleSubmissionRow', () => {
  const base = (puzzleType: string, result: Record<string, unknown>): OutboxItem => ({
    clientId: 'client-1',
    eventId: 'event-1',
    teamId: 'team-1',
    kind: 'puzzle-result',
    gameId: 'game-1',
    createdAt: '2026-08-26T10:00:00.000Z',
    payload: { puzzleType, result },
  })

  it('mirrors the drained server row: same id, approved, original created_at', () => {
    const row = queuedPuzzleSubmissionRow(base('wordle', { guesses: ['AUDIO', 'RADIO'] }))
    expect(row).toEqual({
      id: 'client-1',
      event_id: 'event-1',
      team_id: 'team-1',
      game_id: 'game-1',
      media_url: 'wordle:2',
      media_type: 'puzzle',
      status: 'approved',
      // The server re-scores authoritatively on drain; the provisional row
      // makes no points claim of its own.
      points_awarded: null,
      created_at: '2026-08-26T10:00:00.000Z',
    })
  })

  it('media_url matches the RPC format per type', () => {
    expect(
      queuedPuzzleSubmissionRow(base('matching', { attempts: 7, wrongMatches: 2 })).media_url,
    ).toBe('matching:7')
    expect(
      queuedPuzzleSubmissionRow(base('crossword', { cells: {}, solveSeconds: 123, hintsUsed: 1 }))
        .media_url,
    ).toBe('crossword:123')
    // Postgres round(greatest(seconds, 0)) parity on the odd shapes.
    expect(queuedPuzzleSubmissionRow(base('crossword', { solveSeconds: 89.5 })).media_url).toBe(
      'crossword:90',
    )
    expect(queuedPuzzleSubmissionRow(base('crossword', { solveSeconds: -4 })).media_url).toBe(
      'crossword:0',
    )
  })

  it('a malformed payload still yields a well-formed approved row', () => {
    const row = queuedPuzzleSubmissionRow(base('wordle', {}))
    expect(row.media_url).toBe('wordle:0')
    expect(row.status).toBe('approved')
    expect(queuedPuzzleSubmissionRow(base('matching', {})).media_url).toBe('matching:0')
    expect(queuedPuzzleSubmissionRow(base('crossword', {})).media_url).toBe('crossword:0')
  })
})
