import { describe, expect, it } from 'vitest'

import { daysRemaining } from '@/lib/bin'

describe('daysRemaining', () => {
  it('counts down from 30 on the day of deletion', () => {
    expect(daysRemaining(new Date().toISOString())).toBe(30)
  })

  it('clamps to 0 once the 30-day window has passed', () => {
    const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
    expect(daysRemaining(longAgo)).toBe(0)
  })

  it('is roughly halfway at 15 days in', () => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    expect(daysRemaining(fifteenDaysAgo)).toBeGreaterThanOrEqual(14)
    expect(daysRemaining(fifteenDaysAgo)).toBeLessThanOrEqual(15)
  })
})
