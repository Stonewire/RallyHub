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

  // The old hand-picked 0.32 cut flipped to white across a whole band of
  // ordinary mid brands where charcoal reads better, #5B9BD5 taking white at
  // 2.96:1 against charcoal's 3.65:1. The crossover is now derived from the
  // ink itself, so it cannot drift again.
  it('keeps charcoal on mid brands, where it out-contrasts white', () => {
    for (const brand of ['#5B9BD5', '#2196F3', '#FF5722', '#3FA535', '#00A550']) {
      expect(textOnAccent(brand)).toBe('#3E3D3E')
    }
  })

  it('still flips to white just below the crossover', () => {
    // Luminance 0.166 and 0.151: white wins by a wide margin on both.
    expect(textOnAccent('#4A7C59')).toBe('#ffffff')
    expect(textOnAccent('#7E57C2')).toBe('#ffffff')
  })

  it('falls back to charcoal when the colour cannot be read', () => {
    expect(textOnAccent('')).toBe('#3E3D3E')
    expect(textOnAccent(null)).toBe('#3E3D3E')
    expect(textOnAccent('rgb(1,2,3)')).toBe('#3E3D3E')
  })
})
