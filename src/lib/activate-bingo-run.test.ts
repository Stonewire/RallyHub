import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The client fallback of bingo activation resets event_state for a brand-new
 * run. A Start press racing that activation may already have begun playback
 * and written bingo_state='playing'; the reset must never flip that row back
 * to 'waiting' mid-song. The guard lives in the UPDATE itself, so the stubbed
 * database records exactly which filters the write carried.
 */

vi.mock('@/lib/live-event-access', () => ({
  ensureLiveEventAccess: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/live-broadcast', () => ({
  publishLiveBundlePatch: vi.fn().mockResolvedValue(undefined),
  bingoRunRowToBroadcast: (row: unknown) => row,
}))

type FilterRecord = [column: string, op: string, value: unknown]

const db = {
  existingRun: null as null | {
    id: string
    play_order: string[]
    current_play_index: number
  },
  teams: [] as { id: string; name: string }[],
  games: [] as { id: string; config: unknown }[],
  eventStateUpdates: [] as { patch: Record<string, unknown>; filters: FilterRecord[] }[],
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      // Force the client fallback path: the edge function is unreachable.
      invoke: async () => {
        throw new Error('edge function unavailable')
      },
    },
    rpc: async () => ({ data: db.games, error: null }),
    from(table: string) {
      if (table === 'bingo_runs') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: db.existingRun, error: null }),
              }),
            }),
          }),
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => ({
                data: {
                  id: 'run-1',
                  play_order: row.play_order,
                  current_play_index: 0,
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'teams') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: db.teams, error: null }),
            }),
          }),
        }
      }
      if (table === 'bingo_team_cards') {
        return {
          insert: async () => ({ error: null }),
          select: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
        }
      }
      if (table === 'event_state') {
        return {
          update(patch: Record<string, unknown>) {
            const record = { patch, filters: [] as FilterRecord[] }
            db.eventStateUpdates.push(record)
            const chain = {
              eq(column: string, value: unknown) {
                record.filters.push([column, 'eq', value])
                return chain
              },
              neq(column: string, value: unknown) {
                record.filters.push([column, 'neq', value])
                return chain
              },
              then(resolve: (value: { data: null; error: null }) => unknown) {
                return resolve({ data: null, error: null })
              },
            }
            return chain
          },
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { event_id: 'event-1', bingo_state: 'waiting' },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  },
}))

const { activateBingoRun } = await import('@/lib/activate-bingo-run')

const tracks = Array.from({ length: 25 }, (_, i) => ({
  id: `t${i}`,
  title: `Track ${i}`,
  artist: 'Artist',
}))

beforeEach(() => {
  db.existingRun = null
  db.teams = [{ id: 'team-1', name: 'Team 1' }]
  db.games = [{ id: 'game-1', config: { tracks } }]
  db.eventStateUpdates = []
})

describe('activateBingoRun client fallback event_state reset', () => {
  it('resets a fresh run conditionally, never over a playing row', async () => {
    const result = await activateBingoRun('event-1', 'game-1', 2)

    expect(result.alreadyActive).toBe(false)
    expect(result.runId).toBe('run-1')
    expect(db.eventStateUpdates).toHaveLength(1)

    const reset = db.eventStateUpdates[0]
    expect(reset.patch.bingo_state).toBe('waiting')
    expect(reset.patch.current_question_index).toBe(0)
    // The guard is part of the UPDATE itself (zero rows matched when the
    // round is already playing), not a read-then-write that could race.
    expect(reset.filters).toContainEqual(['event_id', 'eq', 'event-1'])
    expect(reset.filters).toContainEqual(['bingo_state', 'neq', 'playing'])
  })

  it('does not touch event_state when the run already exists', async () => {
    db.existingRun = {
      id: 'run-9',
      play_order: ['t0', 't1', 't2', 't3', 't4'],
      current_play_index: 2,
    }

    const result = await activateBingoRun('event-1', 'game-1', 2)

    expect(result.alreadyActive).toBe(true)
    expect(result.runId).toBe('run-9')
    expect(db.eventStateUpdates).toHaveLength(0)
  })
})
