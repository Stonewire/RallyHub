import { describe, expect, it } from 'vitest'

import { formatClockTimer } from '@/lib/live-event'

describe('formatClockTimer', () => {
  it('shows a two-hour event as H:MM:SS, never as minutes past 99', () => {
    expect(formatClockTimer(7200)).toBe('2:00:00')
  })

  it('keeps the hour digit at zero under an hour', () => {
    expect(formatClockTimer(45 * 60)).toBe('0:45:00')
  })

  it('pads minutes and seconds', () => {
    expect(formatClockTimer(3661)).toBe('1:01:01')
  })

  it('floors fractions and clamps negatives', () => {
    expect(formatClockTimer(59.9)).toBe('0:00:59')
    expect(formatClockTimer(-5)).toBe('0:00:00')
  })
})
