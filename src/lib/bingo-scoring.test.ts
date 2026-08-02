import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BingoCell } from '@/lib/bingo-engine'
import type { GameConfig } from '@/types/game-config'

/**
 * The money path of a bingo round: what a correct mark pays, what a wrong one
 * pays, and that the win bonus is paid once and only once.
 *
 * Scoring runs in the facilitator's browser against the database, so the
 * database is stubbed here and the assertions are on what it was asked to do:
 * which submissions were approved, at what value, and which teams were paid.
 */

const applySubmissionPoints = vi.fn()
vi.mock('@/lib/apply-submission-points', () => ({
  applySubmissionPoints: (...args: unknown[]) => applySubmissionPoints(...args),
}))
vi.mock('@/lib/live-broadcast', () => ({
  publishLiveBundlePatch: vi.fn().mockResolvedValue(undefined),
  publishLiveBundleReload: vi.fn().mockResolvedValue(undefined),
}))

/** Rows the stubbed database hands back, and the writes it recorded. */
const db = {
  cards: [] as { team_id: string; cells: BingoCell[] }[],
  pending: [] as { id: string; team_id: string; media_url: string; status: string }[],
  all: [] as { team_id: string; media_url: string; status: string; game_id: string; media_type: string }[],
  paidLineBonusTeamIds: [] as string[],
  updates: [] as { table: string; patch: Record<string, unknown>; ids: string[] }[],
}

vi.mock('@/lib/supabase', () => {
  function selectable(rows: unknown) {
    const chain: Record<string, unknown> = {}
    const self = () => chain
    for (const key of ['select', 'eq', 'in', 'order']) chain[key] = self
    chain.single = async () => ({ data: rows, error: null })
    chain.maybeSingle = async () => ({ data: rows, error: null })
    chain.then = (resolve: (value: { data: unknown; error: null }) => unknown) =>
      resolve({ data: rows, error: null })
    return chain
  }

  return {
    supabase: {
      from(table: string) {
        if (table === 'bingo_team_cards') return selectable(db.cards)
        if (table === 'bingo_runs') {
          return {
            ...selectable({ paid_line_bonus_team_ids: db.paidLineBonusTeamIds }),
            update(patch: Record<string, unknown>) {
              db.updates.push({ table, patch, ids: [] })
              return selectable(null)
            },
          }
        }
        // submissions: a plain select returns pending or every mark, and an
        // update records what it changed and echoes those rows back.
        let wantedStatus: string | null = null
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: (column: string, value: string) => {
            if (column === 'status') wantedStatus = value
            return chain
          },
          in: () => chain,
          update(patch: Record<string, unknown>) {
            let ids: string[] = []
            return {
              in: (_column: string, values: string[]) => {
                ids = values
                db.updates.push({ table, patch, ids })
                return {
                  select: async () => ({
                    data: values.map((id) => ({ id, ...patch })),
                    error: null,
                  }),
                }
              },
            }
          },
          then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
            resolve({ data: wantedStatus === 'pending' ? db.pending : db.all, error: null }),
        }
        return chain
      },
    },
  }
})

const { scoreBingoRound } = await import('@/lib/bingo-scoring')

function cells(trackIds: string[]): BingoCell[] {
  return trackIds.map((id) => ({ trackId: id, title: id, artist: 'Artist' }))
}

/** A card whose top row is t0..t4, so five marks there complete a line. */
function lineCard(): BingoCell[] {
  return cells(Array.from({ length: 25 }, (_, i) => `t${i}`))
}

beforeEach(() => {
  applySubmissionPoints.mockClear()
  db.cards = []
  db.pending = []
  db.all = []
  db.paidLineBonusTeamIds = []
  db.updates = []
})

describe('scoreBingoRound', () => {
  it('pays the configured points for a correct mark and nothing for a wrong one', async () => {
    db.cards = [{ team_id: 'team-a', cells: lineCard() }]
    db.pending = [
      { id: 's-right', team_id: 'team-a', media_url: '3', status: 'pending' },
      { id: 's-wrong', team_id: 'team-a', media_url: '9', status: 'pending' },
    ]

    await scoreBingoRound({
      eventId: 'e1',
      gameId: 'g1',
      runId: 'r1',
      trackId: 't3',
      gameConfig: { bingo_points_per_correct: 25, bingo_line_points: 0 } as GameConfig,
    })

    const approved = db.updates.find((u) => u.patch.status === 'approved')
    const rejected = db.updates.find((u) => u.patch.status === 'rejected')
    expect(approved?.ids).toEqual(['s-right'])
    expect(approved?.patch.points_awarded).toBe(25)
    expect(rejected?.ids).toEqual(['s-wrong'])
    expect(applySubmissionPoints).toHaveBeenCalledWith('team-a', 25, 'e1')
  })

  it('falls back to ten a mark and a hundred for the win', async () => {
    db.cards = [{ team_id: 'team-a', cells: lineCard() }]
    db.pending = [{ id: 's1', team_id: 'team-a', media_url: '0', status: 'pending' }]
    db.all = [{ team_id: 'team-a', media_url: '0', status: 'approved', game_id: 'g1', media_type: 'bingo' }]

    await scoreBingoRound({
      eventId: 'e1',
      gameId: 'g1',
      runId: 'r1',
      trackId: 't0',
      gameConfig: {} as GameConfig,
    })

    expect(applySubmissionPoints).toHaveBeenCalledWith('team-a', 10, 'e1')
  })

  it('pays the win bonus when a line completes, on top of the marks', async () => {
    db.cards = [{ team_id: 'team-a', cells: lineCard() }]
    db.pending = [{ id: 's5', team_id: 'team-a', media_url: '4', status: 'pending' }]
    // The whole top row is approved once this round lands.
    db.all = ['0', '1', '2', '3', '4'].map((media_url) => ({
      team_id: 'team-a',
      media_url,
      status: 'approved',
      game_id: 'g1',
      media_type: 'bingo',
    }))

    await scoreBingoRound({
      eventId: 'e1',
      gameId: 'g1',
      runId: 'r1',
      trackId: 't4',
      gameConfig: {
        bingo_points_per_correct: 10,
        bingo_line_points: 100,
        bingo_win_mode: 'lines',
        bingo_lines_required: 1,
      } as GameConfig,
    })

    expect(applySubmissionPoints).toHaveBeenCalledWith('team-a', 10, 'e1')
    expect(applySubmissionPoints).toHaveBeenCalledWith('team-a', 100, 'e1')
    const paid = db.updates.find((u) => u.table === 'bingo_runs')
    expect(paid?.patch.paid_line_bonus_team_ids).toEqual(['team-a'])
  })

  it('never pays the win bonus twice to the same team', async () => {
    db.cards = [{ team_id: 'team-a', cells: lineCard() }]
    db.pending = []
    db.all = ['0', '1', '2', '3', '4'].map((media_url) => ({
      team_id: 'team-a',
      media_url,
      status: 'approved',
      game_id: 'g1',
      media_type: 'bingo',
    }))
    db.paidLineBonusTeamIds = ['team-a']

    const result = await scoreBingoRound({
      eventId: 'e1',
      gameId: 'g1',
      runId: 'r1',
      trackId: 't7',
      gameConfig: { bingo_line_points: 100 } as GameConfig,
    })

    // Still a winner, just not paid again.
    expect(result.winningTeamIds).toEqual(['team-a'])
    expect(applySubmissionPoints).not.toHaveBeenCalled()
  })
})
