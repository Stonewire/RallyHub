import { describe, expect, it } from 'vitest'

import { breakDurationSeconds } from '@/lib/live-event'

// The break timer runs during live events, so the seconds field added for the
// new design has to leave every existing stage resolving exactly as before.
describe('breakDurationSeconds', () => {
  it('keeps whole-minute stages authored before the seconds field unchanged', () => {
    expect(breakDurationSeconds({ durationMinutes: 10 }, null)).toBe(600)
  })

  it('defaults to five minutes when the stage sets no duration', () => {
    expect(breakDurationSeconds({}, null)).toBe(300)
    expect(breakDurationSeconds(null, null)).toBe(300)
  })

  it('adds the seconds component when present', () => {
    expect(breakDurationSeconds({ durationMinutes: 2, durationSeconds: 30 }, null)).toBe(150)
  })

  it('supports a sub-minute break', () => {
    expect(breakDurationSeconds({ durationMinutes: 0, durationSeconds: 45 }, null)).toBe(45)
  })

  it('still prefers a stored running value of at least a minute', () => {
    expect(breakDurationSeconds({ durationMinutes: 2, durationSeconds: 30 }, 90)).toBe(90)
  })

  it('ignores a stored value below a minute, which is a stale tick not a duration', () => {
    expect(breakDurationSeconds({ durationMinutes: 1, durationSeconds: 15 }, 30)).toBe(75)
  })
})
