import { describe, expect, it } from 'vitest'

import {
  bingoTeamGuessStates,
  bingoVisualizerBars,
  markMapsEqual,
  pendingBingoMarkIdsByTeam,
  teamInitials,
  type BingoMarkSubmission,
} from '@/lib/bingo-display'

const GAME = 'game-1'

function sub(over: Partial<BingoMarkSubmission>): BingoMarkSubmission {
  return {
    id: 'sub-1',
    team_id: 'team-1',
    game_id: GAME,
    media_type: 'bingo',
    media_url: '7',
    status: 'pending',
    created_at: '2026-08-26T10:00:00Z',
    ...over,
  }
}

describe('pendingBingoMarkIdsByTeam', () => {
  it('maps each team to its latest pending mark', () => {
    const subs = [
      sub({ id: 'a', team_id: 't1', created_at: '2026-08-26T10:00:00Z' }),
      sub({ id: 'b', team_id: 't1', created_at: '2026-08-26T10:00:05Z' }),
      sub({ id: 'c', team_id: 't2' }),
    ]
    const map = pendingBingoMarkIdsByTeam(subs, GAME)
    expect(map.get('t1')).toBe('b')
    expect(map.get('t2')).toBe('c')
  })

  it('ignores claim rows, other games, other media types and settled marks', () => {
    const subs = [
      sub({ id: 'claim', media_url: 'claim' }),
      sub({ id: 'null-url', media_url: null }),
      sub({ id: 'other-game', game_id: 'game-2' }),
      sub({ id: 'quiz', media_type: 'quiz' }),
      sub({ id: 'approved', status: 'approved' }),
      sub({ id: 'rejected', status: 'rejected' }),
    ]
    expect(pendingBingoMarkIdsByTeam(subs, GAME).size).toBe(0)
  })
})

describe('bingoTeamGuessStates', () => {
  const teamIds = ['t1', 't2', 't3']

  it('lights marked teams while guessing is open, others stay neutral', () => {
    const subs = [sub({ id: 'a', team_id: 't1' })]
    const states = bingoTeamGuessStates({
      bingoState: 'playing',
      teamIds,
      submissions: subs,
      gameId: GAME,
      rememberedMarkIdByTeam: new Map(),
    })
    expect(states.get('t1')).toBe('marked')
    expect(states.get('t2')).toBe('neutral')
    expect(states.get('t3')).toBe('neutral')
  })

  it('turns remembered marks green or red at reveal, no mark stays neutral', () => {
    const subs = [
      sub({ id: 'a', team_id: 't1', status: 'approved' }),
      sub({ id: 'b', team_id: 't2', status: 'rejected' }),
    ]
    const states = bingoTeamGuessStates({
      bingoState: 'revealed',
      teamIds,
      submissions: subs,
      gameId: GAME,
      rememberedMarkIdByTeam: new Map([
        ['t1', 'a'],
        ['t2', 'b'],
      ]),
    })
    expect(states.get('t1')).toBe('correct')
    expect(states.get('t2')).toBe('wrong')
    expect(states.get('t3')).toBe('neutral')
  })

  it('keeps a still-pending remembered mark lit at reveal and drops deleted rows to neutral', () => {
    const subs = [sub({ id: 'a', team_id: 't1', status: 'pending' })]
    const states = bingoTeamGuessStates({
      bingoState: 'revealed',
      teamIds,
      submissions: subs,
      gameId: GAME,
      rememberedMarkIdByTeam: new Map([
        ['t1', 'a'],
        ['t2', 'gone'],
      ]),
    })
    expect(states.get('t1')).toBe('marked')
    expect(states.get('t2')).toBe('neutral')
  })

  it('is all neutral while waiting or ended, or without a game id', () => {
    const subs = [sub({ id: 'a', team_id: 't1' })]
    for (const bingoState of ['waiting', 'ended', 'active']) {
      const states = bingoTeamGuessStates({
        bingoState,
        teamIds,
        submissions: subs,
        gameId: GAME,
        rememberedMarkIdByTeam: new Map([['t1', 'a']]),
      })
      expect([...states.values()]).toEqual(['neutral', 'neutral', 'neutral'])
    }
    const noGame = bingoTeamGuessStates({
      bingoState: 'playing',
      teamIds,
      submissions: subs,
      gameId: null,
      rememberedMarkIdByTeam: new Map(),
    })
    expect(noGame.get('t1')).toBe('neutral')
  })
})

describe('markMapsEqual', () => {
  it('compares entries, not identity', () => {
    expect(markMapsEqual(new Map([['a', '1']]), new Map([['a', '1']]))).toBe(true)
    expect(markMapsEqual(new Map([['a', '1']]), new Map([['a', '2']]))).toBe(false)
    expect(markMapsEqual(new Map([['a', '1']]), new Map())).toBe(false)
  })
})

describe('teamInitials', () => {
  it('takes initials of the first two words', () => {
    expect(teamInitials('Red Rockets')).toBe('RR')
    expect(teamInitials('  the  quick brown ')).toBe('TQ')
  })

  it('takes two letters of a single word and handles empty names', () => {
    expect(teamInitials('Titans')).toBe('TI')
    expect(teamInitials('Отбор')).toBe('ОТ')
    expect(teamInitials('   ')).toBe('?')
  })
})

describe('bingoVisualizerBars', () => {
  it('is deterministic per seed and varies across seeds', () => {
    const a = bingoVisualizerBars('track-1', 24)
    const b = bingoVisualizerBars('track-1', 24)
    const c = bingoVisualizerBars('track-2', 24)
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
    expect(a).toHaveLength(24)
  })

  it('keeps every bar inside sane animation bounds', () => {
    for (const bar of bingoVisualizerBars('any-song', 48)) {
      expect(bar.min).toBeGreaterThan(0)
      expect(bar.max).toBeLessThanOrEqual(1)
      expect(bar.max).toBeGreaterThan(bar.min)
      expect(bar.durationMs).toBeGreaterThanOrEqual(650)
      expect(bar.durationMs).toBeLessThanOrEqual(1500)
      expect(bar.delayMs).toBeGreaterThanOrEqual(0)
    }
  })
})
