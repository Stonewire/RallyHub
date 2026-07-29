import { describe, expect, it } from 'vitest'

import {
  ACTIVITY_WINDOW_DAYS,
  bucketActivity,
  buildLinePath,
  tallyGameTypes,
} from '@/lib/dashboard-activity'

const END = new Date('2026-07-30T12:00:00.000Z')

describe('bucketActivity', () => {
  it('always returns a full 30-day window, oldest first', () => {
    const points = bucketActivity([], 'submissions', END)

    expect(points).toHaveLength(ACTIVITY_WINDOW_DAYS)
    expect(points[0].date).toBe('2026-07-01')
    expect(points[ACTIVITY_WINDOW_DAYS - 1].date).toBe('2026-07-30')
    expect(points.every((p) => p.value === 0)).toBe(true)
  })

  it('counts submissions per day', () => {
    const points = bucketActivity(
      [
        { created_at: '2026-07-30T08:00:00.000Z', team_id: 'a' },
        { created_at: '2026-07-30T09:00:00.000Z', team_id: 'a' },
        { created_at: '2026-07-29T09:00:00.000Z', team_id: 'b' },
      ],
      'submissions',
      END,
    )

    expect(points.at(-1)).toEqual({ date: '2026-07-30', value: 2 })
    expect(points.at(-2)).toEqual({ date: '2026-07-29', value: 1 })
  })

  it('counts distinct teams per day, not rows', () => {
    const points = bucketActivity(
      [
        { created_at: '2026-07-30T08:00:00.000Z', team_id: 'a' },
        { created_at: '2026-07-30T09:00:00.000Z', team_id: 'a' },
        { created_at: '2026-07-30T10:00:00.000Z', team_id: 'b' },
      ],
      'teams',
      END,
    )

    expect(points.at(-1)).toEqual({ date: '2026-07-30', value: 2 })
  })

  it('ignores rows outside the window', () => {
    const points = bucketActivity(
      [{ created_at: '2026-01-01T08:00:00.000Z', team_id: 'a' }],
      'submissions',
      END,
    )

    expect(points.every((p) => p.value === 0)).toBe(true)
  })
})

describe('buildLinePath', () => {
  it('spans the full width and inverts the y axis', () => {
    const path = buildLinePath(
      [
        { date: '2026-07-29', value: 0 },
        { date: '2026-07-30', value: 10 },
      ],
      100,
      50,
    )

    expect(path).toBe('M 0 50 L 100 0')
  })

  it('draws a flat baseline when every value is zero', () => {
    const path = buildLinePath(
      [
        { date: '2026-07-29', value: 0 },
        { date: '2026-07-30', value: 0 },
      ],
      100,
      50,
    )

    expect(path).toBe('M 0 50 L 100 50')
  })

  it('returns an empty string for no points', () => {
    expect(buildLinePath([], 100, 50)).toBe('')
  })
})

describe('tallyGameTypes', () => {
  it('counts by type and sorts descending', () => {
    const result = tallyGameTypes([
      { type: 'photo' },
      { type: 'quiz' },
      { type: 'photo' },
    ])

    expect(result).toEqual([
      { type: 'photo', count: 2 },
      { type: 'quiz', count: 1 },
    ])
  })

  it('returns an empty list for no rows', () => {
    expect(tallyGameTypes([])).toEqual([])
  })
})
