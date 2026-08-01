import { describe, expect, it } from 'vitest'

import { extFromUrl, formatMb, mapWithConcurrency, safeFileName } from '@/lib/event-export'

/**
 * The 30 Jul 2026 client event was 134 files / 562 MB and the export appeared
 * to hang because every file was fetched one at a time. mapWithConcurrency is
 * what makes that parallel, so its ordering and its limit both matter.
 */
describe('mapWithConcurrency', () => {
  it('keeps results in input order regardless of completion order', async () => {
    const items = [30, 10, 20, 0]
    const result = await mapWithConcurrency(items, 4, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms))
      return `${i}:${ms}`
    })
    expect(result).toEqual(['0:30', '1:10', '2:20', '3:0'])
  })

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0
    let peak = 0
    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 6, async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight -= 1
    })
    expect(peak).toBeLessThanOrEqual(6)
    expect(peak).toBeGreaterThan(1)
  })

  it('processes every item exactly once', async () => {
    const seen: number[] = []
    await mapWithConcurrency(Array.from({ length: 50 }, (_, i) => i), 6, async (n) => {
      seen.push(n)
    })
    expect(seen).toHaveLength(50)
    expect(new Set(seen).size).toBe(50)
  })

  it('handles an empty list without hanging', async () => {
    expect(await mapWithConcurrency([], 6, async () => 1)).toEqual([])
  })
})

describe('safeFileName', () => {
  it('strips characters that break archive entries on Windows', () => {
    expect(safeFileName('Team A/B: "best" <shot>')).toBe('Team_A_B_best_shot_')
  })

  it('caps very long names', () => {
    expect(safeFileName('x'.repeat(300))).toHaveLength(120)
  })
})

describe('extFromUrl', () => {
  it('reads the extension and ignores query strings', () => {
    expect(extFromUrl('https://x/y/photo.jpg?token=abc', 'bin')).toBe('jpg')
  })

  it('falls back when there is no extension', () => {
    expect(extFromUrl('https://x/y/noext', 'mp4')).toBe('mp4')
  })
})

describe('formatMb', () => {
  it('scales units for progress display', () => {
    expect(formatMb(512)).toBe('512 B')
    expect(formatMb(2048)).toBe('2 KB')
    expect(formatMb(5 * 1024 * 1024)).toBe('5 MB')
    expect(formatMb(2 * 1024 * 1024 * 1024)).toBe('2.0 GB')
  })
})
