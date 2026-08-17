import { describe, it, expect } from 'vitest'

import {
  btrimSpaces,
  sha256Hex,
  scoreOfflineText,
  wordleFeedbackLocal,
  wordlePointsLocal,
  matchingPointsLocal,
  crosswordPointsLocal,
  crosswordSolvedIdsLocal,
} from './scoring'

// sha256('RALLYHUB') — verified equal to the server's
// encode(digest(btrim('RALLYHUB'),'sha256'),'hex') on the QA event.
const RALLYHUB_HASH = 'c786125c6b2de01b56331b3a0eb46ce8442d2c0bc38b72798153670dcd6be3c1'

describe('offline text scoring', () => {
  it('sha256Hex matches the known server hash', async () => {
    expect(await sha256Hex('RALLYHUB')).toBe(RALLYHUB_HASH)
  })

  it('btrimSpaces strips only spaces, not tabs/newlines', () => {
    expect(btrimSpaces('  hi  ')).toBe('hi')
    expect(btrimSpaces('\thi\n')).toBe('\thi\n')
  })

  it('type_text: correct answer matches after space-trim', async () => {
    const key = { text_correct_answer_hashes: [RALLYHUB_HASH] }
    expect(await scoreOfflineText('type_text', key, 'RALLYHUB')).toBe(true)
    expect(await scoreOfflineText('type_text', key, '  RALLYHUB  ')).toBe(true)
    expect(await scoreOfflineText('type_text', key, 'rallyhub')).toBe(false) // case-sensitive
    expect(await scoreOfflineText('type_text', key, 'WRONG')).toBe(false)
  })

  it('choose_answer: compares the option id', async () => {
    const key = { text_correct_answer_id: 'opt-2' }
    expect(await scoreOfflineText('choose_answer', key, 'opt-2')).toBe(true)
    expect(await scoreOfflineText('choose_answer', key, 'opt-1')).toBe(false)
  })

  it('no key or empty hashes -> not correct', async () => {
    expect(await scoreOfflineText('type_text', undefined, 'x')).toBe(false)
    expect(await scoreOfflineText('type_text', { text_correct_answer_hashes: [] }, 'x')).toBe(false)
  })
})

describe('puzzle scoring mirrors', () => {
  it('wordle feedback handles duplicate letters like the server', () => {
    // answer SPEED, guess ERASE: E present, R absent, A absent, S present,
    // E present (two Es in answer, both consumable)
    expect(wordleFeedbackLocal('SPEED', 'ERASE')).toEqual([
      'present', 'absent', 'absent', 'present', 'present',
    ])
    // answer TEAM, guess TEAM: all correct
    expect(wordleFeedbackLocal('TEAM', 'team')).toEqual([
      'correct', 'correct', 'correct', 'correct',
    ])
    // answer ABBA, guess AABB: A correct, A present, B correct, B present
    expect(wordleFeedbackLocal('ABBA', 'AABB')).toEqual([
      'correct', 'present', 'correct', 'present',
    ])
  })

  it('wordle points: 10% decay per extra attempt, 10% floor', () => {
    expect(wordlePointsLocal(100, 1)).toBe(100)
    expect(wordlePointsLocal(100, 2)).toBe(90)
    expect(wordlePointsLocal(100, 3)).toBe(81)
    expect(wordlePointsLocal(100, 50)).toBe(10) // floor
  })

  it('matching points: 5% per wrong match, 25% floor', () => {
    expect(matchingPointsLocal(80, 0)).toBe(80)
    expect(matchingPointsLocal(80, 2)).toBe(72)
    expect(matchingPointsLocal(80, 40)).toBe(20) // floor 25%
  })

  it('crossword points: -5% per 30s over 5min, -10% per hint, 10% floor', () => {
    expect(crosswordPointsLocal(200, 200, 0)).toBe(200) // under 5 min
    expect(crosswordPointsLocal(200, 301, 0)).toBe(190) // one 30s block over
    expect(crosswordPointsLocal(200, 300, 2)).toBe(160) // two hints
    expect(crosswordPointsLocal(200, 4000, 5)).toBe(20) // floor
  })

  it('crossword solve detection matches the row-col cell map convention', () => {
    const words = [
      { id: 'w1', answer: 'CAT', row: 0, col: 0, direction: 'across' as const },
      { id: 'w2', answer: 'CAR', row: 0, col: 0, direction: 'down' as const },
    ]
    const cells = { '0-0': 'c', '0-1': 'A', '0-2': 't', '1-0': 'a', '2-0': 'R' }
    expect(crosswordSolvedIdsLocal(words, cells)).toEqual(['w1', 'w2'])
    expect(crosswordSolvedIdsLocal(words, { ...cells, '2-0': 'x' })).toEqual(['w1'])
  })
})
