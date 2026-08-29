import { describe, expect, it } from 'vitest'

import { textOnAccent } from './live-event'

// R2.3: the takeover dialog painted black text on the event accent, which no
// one could read on a dark brand. Every brand-painted live control now asks
// this helper, so these cases guard the whole sweep.
describe('textOnAccent', () => {
  it('puts white on the dark brand that started this (deep purple)', () => {
    expect(textOnAccent('#2d0a6e')).toBe('#ffffff')
  })

  it('keeps charcoal on the RallyHub gold, the design system pairing', () => {
    expect(textOnAccent('#FFC107')).toBe('#3E3D3E')
  })

  it('handles the extremes', () => {
    expect(textOnAccent('#000000')).toBe('#ffffff')
    expect(textOnAccent('#ffffff')).toBe('#3E3D3E')
  })

  it('weights green above blue: equal channels are not equal light', () => {
    expect(textOnAccent('#00ff00')).toBe('#3E3D3E')
    expect(textOnAccent('#0000ff')).toBe('#ffffff')
  })

  it('falls back to charcoal when the colour cannot be read', () => {
    expect(textOnAccent('')).toBe('#3E3D3E')
    expect(textOnAccent(null)).toBe('#3E3D3E')
    expect(textOnAccent('rgb(1,2,3)')).toBe('#3E3D3E')
  })
})
