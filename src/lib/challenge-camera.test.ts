import { describe, expect, it } from 'vitest'

import { buildChallengeVideoConstraints } from '@/lib/challenge-camera'

/**
 * A hard `min`/`exact` constraint makes getUserMedia reject with
 * OverconstrainedError on cameras that cannot meet it (every 720p landscape
 * laptop webcam, plenty of tablets), which kills capture entirely. Only ideals.
 */
describe('buildChallengeVideoConstraints', () => {
  it('uses no hard constraints', () => {
    const { video } = buildChallengeVideoConstraints('environment', true)
    const ranges = Object.values(video as Record<string, unknown>).filter(
      (v) => typeof v === 'object' && v !== null,
    )
    expect(ranges.length).toBeGreaterThan(0)
    for (const range of ranges) {
      expect(Object.keys(range as object)).toEqual(['ideal'])
    }
  })

  it('passes the facing mode and audio flag through', () => {
    expect(buildChallengeVideoConstraints('user', false)).toMatchObject({
      video: { facingMode: 'user' },
      audio: false,
    })
  })
})
