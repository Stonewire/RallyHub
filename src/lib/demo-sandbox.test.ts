import { describe, expect, it } from 'vitest'

import { formatDemoCountdown, isDemoHost } from '@/lib/demo-sandbox'

describe('demo sandbox host detection', () => {
  it('recognizes the production demo host', () => {
    expect(isDemoHost('demo.rallyhub.games')).toBe(true)
  })

  it('recognizes the local demo subdomain', () => {
    expect(isDemoHost('demo.localhost')).toBe(true)
  })

  it('does not treat ordinary tenant or platform hosts as demo', () => {
    expect(isDemoHost('app.rallyhub.games')).toBe(false)
    expect(isDemoHost('northstar.app.rallyhub.games')).toBe(false)
  })
})

describe('demo reset countdown', () => {
  it('formats minutes and seconds with stable padding', () => {
    expect(formatDemoCountdown(29 * 60_000 + 5_000)).toBe('29:05')
  })

  it('rounds partial seconds up and never displays a negative time', () => {
    expect(formatDemoCountdown(1)).toBe('00:01')
    expect(formatDemoCountdown(-10_000)).toBe('00:00')
  })
})
