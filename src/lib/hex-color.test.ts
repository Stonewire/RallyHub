import { describe, expect, it } from 'vitest'

import {
  hexToRgb,
  isValidHex,
  normalizeHex,
  readableTextOn,
  rgbToHex,
} from '@/lib/hex-color'

describe('normalizeHex', () => {
  it('expands shorthand and lowercases', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex('FEC10A')).toBe('#fec10a')
  })

  it('returns null for partial input, so typing is not fought mid-edit', () => {
    expect(normalizeHex('#ff')).toBeNull()
    expect(normalizeHex('')).toBeNull()
    expect(normalizeHex('#gggggg')).toBeNull()
  })
})

describe('hexToRgb and rgbToHex round trip', () => {
  it('round trips a brand colour', () => {
    const rgb = hexToRgb('#ffc107')
    expect(rgb).toEqual({ r: 255, g: 193, b: 7 })
    expect(rgbToHex(rgb!)).toBe('#ffc107')
  })

  it('pads single-digit channels', () => {
    expect(rgbToHex({ r: 0, g: 0, b: 7 })).toBe('#000007')
  })

  it('clamps out-of-range channels rather than producing invalid hex', () => {
    expect(rgbToHex({ r: 300, g: -20, b: 128 })).toBe('#ff0080')
  })
})

describe('isValidHex', () => {
  it('accepts both lengths, with or without the hash', () => {
    for (const value of ['#fff', 'fff', '#ffc107', 'FFC107']) {
      expect(isValidHex(value)).toBe(true)
    }
  })

  it('rejects anything else', () => {
    for (const value of ['#ffff', 'red', '#12345g', '']) {
      expect(isValidHex(value)).toBe(false)
    }
  })
})

describe('readableTextOn', () => {
  it('puts dark text on light colours and light text on dark', () => {
    expect(readableTextOn('#ffffff')).toBe('#1f2126')
    expect(readableTextOn('#ffc107')).toBe('#1f2126')
    expect(readableTextOn('#1d1f24')).toBe('#ffffff')
  })

  it('weights by luminance, so pure blue counts as dark', () => {
    // A plain channel average would call this light and produce unreadable text.
    expect(readableTextOn('#0000ff')).toBe('#ffffff')
  })
})
