import type { GameType } from '@/types/database'

export const ACTIVITY_WINDOW_DAYS = 30

export type ActivityMetric = 'submissions' | 'teams'

export type ActivityPoint = { date: string; value: number }

export type SubmissionRow = { created_at: string; team_id: string }

export type GameTypeCount = { type: GameType; count: number }

/** UTC calendar day key, so bucketing does not drift with the viewer's zone. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Buckets submission rows into one point per day for the trailing
 * ACTIVITY_WINDOW_DAYS ending on endDate inclusive. Days with no rows are
 * emitted as zero so the chart always draws a continuous line.
 */
export function bucketActivity(
  rows: SubmissionRow[],
  metric: ActivityMetric,
  endDate: Date,
): ActivityPoint[] {
  const keys: string[] = []
  const end = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
    ),
  )

  for (let offset = ACTIVITY_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    const day = new Date(end)
    day.setUTCDate(day.getUTCDate() - offset)
    keys.push(dayKey(day))
  }

  const inWindow = new Set(keys)
  const counts = new Map<string, number>()
  const teamsSeen = new Map<string, Set<string>>()

  for (const row of rows) {
    const key = row.created_at.slice(0, 10)
    if (!inWindow.has(key)) continue

    if (metric === 'teams') {
      const set = teamsSeen.get(key) ?? new Set<string>()
      set.add(row.team_id)
      teamsSeen.set(key, set)
    } else {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  return keys.map((date) => ({
    date,
    value:
      metric === 'teams'
        ? (teamsSeen.get(date)?.size ?? 0)
        : (counts.get(date) ?? 0),
  }))
}

function scalePoints(
  points: ActivityPoint[],
  width: number,
  height: number,
): { x: number; y: number }[] {
  const max = Math.max(...points.map((p) => p.value), 0)
  const lastIndex = Math.max(points.length - 1, 1)

  return points.map((point, index) => ({
    x: (index / lastIndex) * width,
    // An all-zero series has no range to scale, so pin it to the baseline.
    y: max === 0 ? height : height - (point.value / max) * height,
  }))
}

function formatCoordinate(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

/** SVG `d` for the series outline. */
export function buildLinePath(
  points: ActivityPoint[],
  width: number,
  height: number,
): string {
  if (points.length === 0) return ''

  return scalePoints(points, width, height)
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${formatCoordinate(point.x)} ${formatCoordinate(point.y)}`,
    )
    .join(' ')
}

/** SVG `d` for the shaded area beneath the series. */
export function buildAreaPath(
  points: ActivityPoint[],
  width: number,
  height: number,
): string {
  const line = buildLinePath(points, width, height)
  if (!line) return ''

  return `${line} L ${formatCoordinate(width)} ${formatCoordinate(height)} L 0 ${formatCoordinate(height)} Z`
}

/** Counts submissions per game type, busiest first. */
export function tallyGameTypes(rows: { type: GameType }[]): GameTypeCount[] {
  const counts = new Map<GameType, number>()

  for (const row of rows) {
    counts.set(row.type, (counts.get(row.type) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
}
