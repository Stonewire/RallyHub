import { describe, expect, it } from 'vitest'

import { shouldTriggerBingoLockAndReveal } from '@/lib/bingo-playback'

describe('shouldTriggerBingoLockAndReveal', () => {
  const revealLeadSeconds = 5 // crossfadeSeconds(4) + 1, the app's real default

  it('fires inside the normal reveal-lead window', () => {
    expect(shouldTriggerBingoLockAndReveal(4.5, revealLeadSeconds)).toBe(true)
    expect(shouldTriggerBingoLockAndReveal(5, revealLeadSeconds)).toBe(true)
    expect(shouldTriggerBingoLockAndReveal(0, revealLeadSeconds)).toBe(true)
  })

  it('does not fire while there is plenty of song left', () => {
    expect(shouldTriggerBingoLockAndReveal(10, revealLeadSeconds)).toBe(false)
    expect(shouldTriggerBingoLockAndReveal(5.01, revealLeadSeconds)).toBe(false)
  })

  it('ignores a degenerate negative remaining time', () => {
    expect(shouldTriggerBingoLockAndReveal(-0.1, revealLeadSeconds)).toBe(false)
  })

  it('REGRESSION: still fires when a coarse timeupdate tick skips straight over the window', () => {
    // A throttled/busy tab can jump from e.g. 5.3s remaining to 3.9s remaining
    // in one timeupdate tick, skipping the (crossfadeSeconds, revealLeadSeconds]
    // window entirely. The old condition (remaining > crossfadeSeconds) missed
    // this, silently deferring scoring+reveal until the whole crossfade
    // finished. The new one has no lower bound, so it still fires.
    const remaining = 3.9 // already inside the crossfade zone (< 4)
    expect(shouldTriggerBingoLockAndReveal(remaining, revealLeadSeconds)).toBe(true)
  })
})
