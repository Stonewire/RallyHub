import { describe, expect, it } from 'vitest'

import { pickRecoveredBingoRun, type BingoRunRow } from './use-bingo-run'

function run(overrides: Partial<BingoRunRow> = {}): BingoRunRow {
  return {
    id: 'run-1',
    event_id: 'e1',
    game_id: 'g1',
    stage_index: 0,
    playOrder: ['a', 'b', 'c'],
    current_play_index: 5,
    status: 'playing',
    ...overrides,
  }
}

describe('pickRecoveredBingoRun', () => {
  it('advances the index forward (recovers a missed advance)', () => {
    const cached = run({ current_play_index: 5 })
    const polled = run({ current_play_index: 7 })
    expect(pickRecoveredBingoRun(cached, polled)).toBe(polled)
  })

  it('never rewinds on a stale read', () => {
    const cached = run({ current_play_index: 8 })
    const polled = run({ current_play_index: 3 })
    expect(pickRecoveredBingoRun(cached, polled)).toBe(cached)
  })

  it('ignores an equal read (no-op)', () => {
    const cached = run({ current_play_index: 5 })
    const polled = run({ current_play_index: 5 })
    expect(pickRecoveredBingoRun(cached, polled)).toBe(cached)
  })

  it('accepts a status change even without an index advance', () => {
    const cached = run({ current_play_index: 5, status: 'playing' })
    const polled = run({ current_play_index: 5, status: 'ended' })
    expect(pickRecoveredBingoRun(cached, polled)).toBe(polled)
  })

  it('accepts a different run id (a fresh run replaces the old)', () => {
    const cached = run({ id: 'run-1', current_play_index: 9 })
    const polled = run({ id: 'run-2', current_play_index: 0 })
    expect(pickRecoveredBingoRun(cached, polled)).toBe(polled)
  })

  it('does not clobber a live run with a null read', () => {
    const cached = run()
    expect(pickRecoveredBingoRun(cached, null)).toBe(cached)
  })

  it('adopts the polled run when nothing is cached', () => {
    const polled = run()
    expect(pickRecoveredBingoRun(null, polled)).toBe(polled)
  })
})
