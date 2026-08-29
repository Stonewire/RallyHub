import { describe, expect, it } from 'vitest'

import {
  bingoAnchorTargetSeconds,
  bingoSyncSeekSeconds,
  bingoTrackAnchorKey,
  parseBingoTrackAnchor,
  shouldTriggerBingoLockAndReveal,
} from '@/lib/bingo-playback'

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

describe('parseBingoTrackAnchor', () => {
  const good = { trackId: 't1', positionSeconds: 12.5, atMs: 1_700_000_000_000, paused: false }

  it('reads a well formed anchor back', () => {
    expect(parseBingoTrackAnchor(good)).toEqual(good)
  })

  it('defaults paused to false when the field is missing or junk', () => {
    expect(parseBingoTrackAnchor({ ...good, paused: undefined })?.paused).toBe(false)
    expect(parseBingoTrackAnchor({ ...good, paused: 'yes' })?.paused).toBe(false)
    expect(parseBingoTrackAnchor({ ...good, paused: true })?.paused).toBe(true)
  })

  it('rejects anything that is not a usable anchor', () => {
    expect(parseBingoTrackAnchor(null)).toBeNull()
    expect(parseBingoTrackAnchor('nope')).toBeNull()
    expect(parseBingoTrackAnchor({})).toBeNull()
    expect(parseBingoTrackAnchor({ ...good, trackId: '  ' })).toBeNull()
    expect(parseBingoTrackAnchor({ ...good, positionSeconds: -1 })).toBeNull()
    expect(parseBingoTrackAnchor({ ...good, positionSeconds: 'x' })).toBeNull()
    expect(parseBingoTrackAnchor({ ...good, atMs: 0 })).toBeNull()
  })
})

describe('bingoTrackAnchorKey', () => {
  it('changes only when the anchor changes', () => {
    const a = { trackId: 't1', positionSeconds: 3, atMs: 100, paused: false }
    expect(bingoTrackAnchorKey(a)).toBe(bingoTrackAnchorKey({ ...a }))
    expect(bingoTrackAnchorKey(a)).not.toBe(bingoTrackAnchorKey({ ...a, atMs: 101 }))
    expect(bingoTrackAnchorKey(null)).toBe('none')
  })
})

describe('bingoAnchorTargetSeconds', () => {
  const at = 1_700_000_000_000
  const anchor = { trackId: 't1', positionSeconds: 0, atMs: at, paused: false }

  it('adds the time elapsed since the stamp', () => {
    expect(
      bingoAnchorTargetSeconds({ anchor, trackId: 't1', nowMs: at + 20_000 }),
    ).toBeCloseTo(20)
  })

  it('starts from a non-zero anchor position (facilitator scrubbed)', () => {
    expect(
      bingoAnchorTargetSeconds({
        anchor: { ...anchor, positionSeconds: 12 },
        trackId: 't1',
        nowMs: at + 3_000,
      }),
    ).toBeCloseTo(15)
  })

  it('holds still while the room is paused', () => {
    expect(
      bingoAnchorTargetSeconds({
        anchor: { ...anchor, positionSeconds: 8, paused: true },
        trackId: 't1',
        nowMs: at + 60_000,
      }),
    ).toBeCloseTo(8)
  })

  it('ignores an anchor for a different track', () => {
    // The crossfade starts the next song seconds before the round advances, so
    // the display receives the next track's anchor while still on this one.
    expect(bingoAnchorTargetSeconds({ anchor, trackId: 't2', nowMs: at })).toBeNull()
    expect(bingoAnchorTargetSeconds({ anchor, trackId: null, nowMs: at })).toBeNull()
    expect(bingoAnchorTargetSeconds({ anchor: null, trackId: 't1', nowMs: at })).toBeNull()
  })

  it('applies the crossfade lead once the round has advanced', () => {
    // Anchor written when the crossfade started, read 4s later when the
    // display finally moves to that track: it must land 4s in, not at 0:00.
    expect(
      bingoAnchorTargetSeconds({ anchor, trackId: 't1', nowMs: at + 4_000 }),
    ).toBeCloseTo(4)
  })

  it('tolerates a small clock skew but rejects a wild one', () => {
    expect(bingoAnchorTargetSeconds({ anchor, trackId: 't1', nowMs: at - 500 })).toBeCloseTo(0)
    expect(bingoAnchorTargetSeconds({ anchor, trackId: 't1', nowMs: at - 5_000 })).toBeNull()
  })

  it('rejects a stale anchor from an earlier round', () => {
    expect(
      bingoAnchorTargetSeconds({ anchor, trackId: 't1', nowMs: at + 3_600_000 }),
    ).toBeNull()
  })

  it('rejects a target past the end of the clip', () => {
    expect(
      bingoAnchorTargetSeconds({
        anchor,
        trackId: 't1',
        nowMs: at + 31_000,
        durationSeconds: 30,
      }),
    ).toBeNull()
    // An unknown duration must not block the sync.
    expect(
      bingoAnchorTargetSeconds({ anchor, trackId: 't1', nowMs: at + 31_000, durationSeconds: 0 }),
    ).toBeCloseTo(31)
    expect(
      bingoAnchorTargetSeconds({
        anchor,
        trackId: 't1',
        nowMs: at + 31_000,
        durationSeconds: Number.NaN,
      }),
    ).toBeCloseTo(31)
  })
})

describe('bingoSyncSeekSeconds', () => {
  const at = 1_700_000_000_000
  const anchor = { trackId: 't1', positionSeconds: 0, atMs: at, paused: false }
  const base = { anchor, trackId: 't1', durationSeconds: 30 }

  it('leaves a copy that is already close enough alone', () => {
    expect(
      bingoSyncSeekSeconds({ ...base, nowMs: at + 10_000, currentSeconds: 10.4 }),
    ).toBeNull()
    expect(bingoSyncSeekSeconds({ ...base, nowMs: at + 10_000, currentSeconds: 9.6 })).toBeNull()
  })

  it('corrects a display that missed the flip and picked it up on the 4s poll', () => {
    expect(bingoSyncSeekSeconds({ ...base, nowMs: at + 4_000, currentSeconds: 0 })).toBeCloseTo(4)
  })

  it('corrects a display opened mid-song', () => {
    expect(bingoSyncSeekSeconds({ ...base, nowMs: at + 20_000, currentSeconds: 0 })).toBeCloseTo(
      20,
    )
  })

  it('pulls a copy that has run ahead back', () => {
    expect(bingoSyncSeekSeconds({ ...base, nowMs: at + 5_000, currentSeconds: 9 })).toBeCloseTo(5)
  })

  it('honours a caller supplied tolerance', () => {
    expect(
      bingoSyncSeekSeconds({
        ...base,
        nowMs: at + 10_000,
        currentSeconds: 10.4,
        toleranceSeconds: 0.2,
      }),
    ).toBeCloseTo(10)
  })

  it('seeks when the copy has no usable position yet', () => {
    expect(
      bingoSyncSeekSeconds({ ...base, nowMs: at + 6_000, currentSeconds: Number.NaN }),
    ).toBeCloseTo(6)
  })

  it('does nothing without a usable anchor', () => {
    expect(
      bingoSyncSeekSeconds({ ...base, anchor: null, nowMs: at, currentSeconds: 0 }),
    ).toBeNull()
    expect(
      bingoSyncSeekSeconds({ ...base, trackId: 'other', nowMs: at, currentSeconds: 0 }),
    ).toBeNull()
  })
})
