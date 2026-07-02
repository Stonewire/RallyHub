import { describe, expect, it } from 'vitest'

import {
  bingoCellIndexForTrackId,
  missedBingoCellIndices,
  parseAnnouncedWinnerIds,
  parseRevealedTrackIds,
  resolveBingoSubmissionCellIndex,
  resolveBingoSubmissionTrackId,
} from '@/lib/bingo-cell-match'
import {
  buildUniquePlayOrder,
  generateBingoRun,
  trackForPlayIndex,
  type BingoCell,
  type BingoTrack,
} from '@/lib/bingo-engine'
import {
  approvedBingoCellIndices,
  bingoWinAchieved,
  bingoWinningHighlightCells,
  countCompleteBingoLines,
  isBingoFullHouse,
  resolveBingoWinConfig,
} from '@/lib/bingo-lines'

function makeCells(n = 25): BingoCell[] {
  return Array.from({ length: n }, (_, i) => ({
    trackId: `track-${i}`,
    title: `Title ${i}`,
    artist: `Artist ${i}`,
  }))
}

function makeTracks(n: number): BingoTrack[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    title: `Song ${i}`,
    artist: `Artist ${i}`,
  }))
}

// ─── bingo-lines: win config resolution ───

describe('resolveBingoWinConfig', () => {
  it('resolves full house mode', () => {
    expect(resolveBingoWinConfig({ bingo_win_mode: 'full_house' })).toEqual({
      mode: 'full_house',
      linesRequired: 1,
      includeDiagonals: false,
    })
  })

  it('resolves lines mode with clamping', () => {
    expect(
      resolveBingoWinConfig({ bingo_win_mode: 'lines', bingo_lines_required: 0 }).linesRequired,
    ).toBe(1)
    expect(
      resolveBingoWinConfig({ bingo_win_mode: 'lines', bingo_lines_required: 99 }).linesRequired,
    ).toBe(12)
    expect(
      resolveBingoWinConfig({ bingo_win_mode: 'lines', bingo_lines_required: 3.7 }).linesRequired,
    ).toBe(4)
    expect(
      resolveBingoWinConfig({ bingo_win_mode: 'lines', bingo_include_diagonals: true })
        .includeDiagonals,
    ).toBe(true)
  })

  it('derives legacy winning_lines: diagonal enables diagonals', () => {
    const diag = [0, 6, 12, 18, 24]
    expect(resolveBingoWinConfig({ bingo_winning_lines: [diag] })).toEqual({
      mode: 'lines',
      linesRequired: 1,
      includeDiagonals: true,
    })
  })

  it('derives legacy winning_lines: rows only keeps diagonals off', () => {
    expect(
      resolveBingoWinConfig({ bingo_winning_lines: [[0, 1, 2, 3, 4]] }).includeDiagonals,
    ).toBe(false)
  })

  it('defaults to 1 line, no diagonals', () => {
    expect(resolveBingoWinConfig({})).toEqual({
      mode: 'lines',
      linesRequired: 1,
      includeDiagonals: false,
    })
  })
})

// ─── bingo-lines: win detection (fires the celebration + line bonus) ───

describe('win detection', () => {
  const row0 = [0, 1, 2, 3, 4]
  const col0 = [0, 5, 10, 15, 20]
  const diag = [0, 6, 12, 18, 24]

  it('counts complete rows and columns', () => {
    expect(countCompleteBingoLines(row0, false)).toBe(1)
    expect(countCompleteBingoLines([...row0, ...col0], false)).toBe(2)
    expect(countCompleteBingoLines(row0.slice(0, 4), false)).toBe(0)
  })

  it('counts diagonals only when enabled', () => {
    expect(countCompleteBingoLines(diag, false)).toBe(0)
    expect(countCompleteBingoLines(diag, true)).toBe(1)
  })

  it('detects full house exactly at 25 marks', () => {
    const all = Array.from({ length: 25 }, (_, i) => i)
    expect(isBingoFullHouse(all)).toBe(true)
    expect(isBingoFullHouse(all.slice(0, 24))).toBe(false)
  })

  it('bingoWinAchieved honours linesRequired', () => {
    const oneLine = { mode: 'lines' as const, linesRequired: 1, includeDiagonals: false }
    const twoLines = { mode: 'lines' as const, linesRequired: 2, includeDiagonals: false }
    expect(bingoWinAchieved(row0, oneLine)).toBe(true)
    expect(bingoWinAchieved(row0, twoLines)).toBe(false)
    expect(bingoWinAchieved([...row0, ...col0], twoLines)).toBe(true)
  })

  it('bingoWinAchieved honours full house mode', () => {
    const fh = { mode: 'full_house' as const, linesRequired: 1, includeDiagonals: false }
    expect(bingoWinAchieved(row0, fh)).toBe(false)
    expect(bingoWinAchieved(Array.from({ length: 25 }, (_, i) => i), fh)).toBe(true)
  })

  it('highlight cells match the win decision exactly', () => {
    const win = { mode: 'lines' as const, linesRequired: 1, includeDiagonals: false }
    expect(bingoWinningHighlightCells(row0.slice(0, 4), win).size).toBe(0)
    expect([...bingoWinningHighlightCells(row0, win)].sort((a, b) => a - b)).toEqual(row0)
    const fh = { mode: 'full_house' as const, linesRequired: 1, includeDiagonals: false }
    expect(bingoWinningHighlightCells(Array.from({ length: 25 }, (_, i) => i), fh).size).toBe(25)
  })
})

// ─── bingo-lines: approved cell indices (what counts toward a win) ───

describe('approvedBingoCellIndices', () => {
  const cells = makeCells()
  const base = { media_type: 'bingo', status: 'approved', game_id: 'g1' }

  it('keeps only approved bingo submissions for the game', () => {
    const subs = [
      { ...base, media_url: '3' },
      { ...base, media_url: '4', status: 'pending' },
      { ...base, media_url: '5', game_id: 'other' },
      { ...base, media_url: '6', media_type: 'photo' },
      { ...base, media_url: null },
      { ...base, media_url: 'claim' },
    ]
    expect(approvedBingoCellIndices(subs, 'g1', cells)).toEqual([3])
  })

  it('resolves track-id media_url through the card cells', () => {
    const subs = [{ ...base, media_url: 'track-7' }]
    expect(approvedBingoCellIndices(subs, 'g1', cells)).toEqual([7])
  })

  it('drops indices outside the 5x5 grid', () => {
    const subs = [
      { ...base, media_url: '25' },
      { ...base, media_url: '-1' },
      { ...base, media_url: 'not-on-card' },
    ]
    expect(approvedBingoCellIndices(subs, 'g1', cells)).toEqual([])
  })

  it('falls back to numeric parsing without cells', () => {
    const subs = [
      { ...base, media_url: '12' },
      { ...base, media_url: 'track-3' },
    ]
    expect(approvedBingoCellIndices(subs, 'g1')).toEqual([12])
  })
})

// ─── bingo-cell-match: what approves or rejects a player's mark ───

describe('bingo cell matching', () => {
  const cells = makeCells()

  it('resolves numeric media_url to the trackId at that index', () => {
    expect(resolveBingoSubmissionTrackId('4', cells)).toBe('track-4')
  })

  it('resolves a raw trackId that exists on the card', () => {
    expect(resolveBingoSubmissionTrackId('track-9', cells)).toBe('track-9')
  })

  it('returns null for a track not on the card', () => {
    expect(resolveBingoSubmissionTrackId('unknown', cells)).toBeNull()
    expect(resolveBingoSubmissionTrackId('30', cells)).toBeNull()
  })

  it('resolves cell index from numeric or trackId media_url', () => {
    expect(resolveBingoSubmissionCellIndex('8', cells)).toBe(8)
    expect(resolveBingoSubmissionCellIndex('track-8', cells)).toBe(8)
    expect(resolveBingoSubmissionCellIndex('nope', cells)).toBe(-1)
  })

  it('finds the first cell for a trackId (duplicates take the first)', () => {
    const dup = [...cells]
    dup[20] = { ...dup[20], trackId: 'track-2' }
    expect(bingoCellIndexForTrackId(dup, 'track-2')).toBe(2)
  })

  it('marks revealed-but-unscored cells as missed, skips scored and off-card', () => {
    const scored = new Map<number, 'approved' | 'rejected'>([[1, 'approved']])
    const missed = missedBingoCellIndices(
      cells,
      ['track-1', 'track-2', 'not-on-card'],
      scored,
    )
    expect(missed).toEqual(new Set([2]))
  })

  it('parses revealed/winner id arrays defensively', () => {
    expect(parseRevealedTrackIds(null)).toEqual([])
    expect(parseRevealedTrackIds(['a', '', 42, 'b'])).toEqual(['a', 'b'])
    expect(parseAnnouncedWinnerIds('nope')).toEqual([])
    expect(parseAnnouncedWinnerIds(['w1'])).toEqual(['w1'])
  })
})

// ─── bingo-engine: card generation + play order ───

describe('bingo run generation', () => {
  const teams = [
    { id: 'team-a', name: 'Alpha' },
    { id: 'team-b', name: 'Bravo' },
    { id: 'team-c', name: null },
    { id: 'team-d', name: '  ' },
  ]

  it('generates a 25-cell card per named team only', () => {
    const run = generateBingoRun({
      tracks: makeTracks(30),
      teams,
      gameId: 'g1',
      activationSeed: 'seed-1',
    })
    expect(Object.keys(run.cardsByTeamId).sort()).toEqual(['team-a', 'team-b'])
    for (const card of Object.values(run.cardsByTeamId)) {
      expect(card).toHaveLength(25)
      expect(new Set(card.map((c) => c.trackId)).size).toBe(25)
    }
  })

  it('play order is a permutation of all track ids (no repeats)', () => {
    const tracks = makeTracks(30)
    const run = generateBingoRun({ tracks, teams, gameId: 'g1', activationSeed: 's' })
    expect(run.playOrder).toHaveLength(30)
    expect(new Set(run.playOrder).size).toBe(30)
    expect([...run.playOrder].sort()).toEqual(tracks.map((t) => t.id).sort())
  })

  it('is deterministic for the same seed and differs across seeds', () => {
    const tracks = makeTracks(30)
    const a = generateBingoRun({ tracks, teams, gameId: 'g1', activationSeed: 'same' })
    const b = generateBingoRun({ tracks, teams, gameId: 'g1', activationSeed: 'same' })
    const c = generateBingoRun({ tracks, teams, gameId: 'g1', activationSeed: 'different' })
    expect(a.playOrder).toEqual(b.playOrder)
    expect(a.cardsByTeamId).toEqual(b.cardsByTeamId)
    expect(c.playOrder).not.toEqual(a.playOrder)
  })

  it('two teams get different cards', () => {
    const run = generateBingoRun({
      tracks: makeTracks(30),
      teams,
      gameId: 'g1',
      activationSeed: 's',
    })
    expect(run.cardsByTeamId['team-a'].map((c) => c.trackId)).not.toEqual(
      run.cardsByTeamId['team-b'].map((c) => c.trackId),
    )
  })

  it('fills a 25-cell card even when fewer tracks exist (repeats allowed)', () => {
    const run = generateBingoRun({
      tracks: makeTracks(10),
      teams: [{ id: 'team-a', name: 'Alpha' }],
      gameId: 'g1',
      activationSeed: 's',
    })
    expect(run.cardsByTeamId['team-a']).toHaveLength(25)
    expect(run.playOrder).toHaveLength(10)
  })

  it('rejects empty teams or too few tracks', () => {
    expect(() =>
      generateBingoRun({
        tracks: makeTracks(30),
        teams: [{ id: 'x', name: null }],
        gameId: 'g1',
        activationSeed: 's',
      }),
    ).toThrow(/No active teams/)
    expect(() =>
      generateBingoRun({
        tracks: makeTracks(4),
        teams,
        gameId: 'g1',
        activationSeed: 's',
      }),
    ).toThrow(/at least 5 tracks/)
  })

  it('buildUniquePlayOrder is a deterministic permutation', () => {
    const ids = makeTracks(12).map((t) => t.id)
    const a = buildUniquePlayOrder(ids, 42)
    const b = buildUniquePlayOrder(ids, 42)
    expect(a).toEqual(b)
    expect([...a].sort()).toEqual([...ids].sort())
  })

  it('trackForPlayIndex resolves tracks and returns null past the end', () => {
    const tracks = makeTracks(6)
    const order = buildUniquePlayOrder(
      tracks.map((t) => t.id),
      7,
    )
    expect(trackForPlayIndex(order, 0, tracks)?.id).toBe(order[0])
    expect(trackForPlayIndex(order, 99, tracks)).toBeNull()
  })
})
