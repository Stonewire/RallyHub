import { describe, expect, it } from 'vitest'

import { LOGO_BOX_SIZE, LOGO_MAX_UPSCALE, logoTargetSize } from '@/lib/logo-image'

describe('logoTargetSize', () => {
  it('downscales an oversized logo to fit the box, keeping aspect ratio', () => {
    expect(logoTargetSize(4096, 2048)).toEqual({ width: 1024, height: 512 })
    expect(logoTargetSize(2048, 4096)).toEqual({ width: 512, height: 1024 })
    expect(logoTargetSize(3000, 3000)).toEqual({ width: 1024, height: 1024 })
  })

  it('upscales a slightly small logo to fill the box', () => {
    expect(logoTargetSize(800, 600)).toEqual({ width: 1024, height: 768 })
    expect(logoTargetSize(512, 512)).toEqual({ width: 1024, height: 1024 })
  })

  it('never upscales beyond the cap', () => {
    expect(logoTargetSize(200, 100)).toEqual({
      width: 200 * LOGO_MAX_UPSCALE,
      height: 100 * LOGO_MAX_UPSCALE,
    })
    expect(logoTargetSize(64, 64)).toEqual({ width: 128, height: 128 })
  })

  it('returns null when the logo already fits the box exactly', () => {
    expect(logoTargetSize(LOGO_BOX_SIZE, LOGO_BOX_SIZE)).toBeNull()
    expect(logoTargetSize(LOGO_BOX_SIZE, 400)).toBeNull()
    expect(logoTargetSize(300, LOGO_BOX_SIZE)).toBeNull()
  })

  it('returns null for unusable dimensions', () => {
    expect(logoTargetSize(0, 100)).toBeNull()
    expect(logoTargetSize(100, 0)).toBeNull()
    expect(logoTargetSize(-10, 50)).toBeNull()
    expect(logoTargetSize(Number.NaN, 50)).toBeNull()
    expect(logoTargetSize(50, Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('never rounds a side down to zero', () => {
    expect(logoTargetSize(5000, 1)).toEqual({ width: 1024, height: 1 })
  })
})
