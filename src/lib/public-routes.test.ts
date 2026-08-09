import { describe, expect, it } from 'vitest'
import { isPublicLivePath, RESERVED_TENANT_SUBDOMAINS } from '@/lib/public-routes'

describe('isPublicLivePath', () => {
  it('matches the new primary format', () => {
    expect(isPublicLivePath('/sharphawk/summer-summit/join')).toBe(true)
    expect(isPublicLivePath('/sharphawk/summer-summit/display')).toBe(true)
    expect(isPublicLivePath('/sharphawk/summer-summit/facilitator')).toBe(true)
    expect(isPublicLivePath('/sharphawk/summer-summit/join/red-team')).toBe(true)
  })

  it('matches the legacy slug format', () => {
    expect(isPublicLivePath('/sharphawk/events/summer-summit/teams')).toBe(true)
  })

  it('matches legacy UUID routes', () => {
    expect(isPublicLivePath('/join/8f3c2a10-1111-2222-3333-444455556666')).toBe(true)
    expect(isPublicLivePath('/facilitator/8f3c2a10-1111-2222-3333-444455556666')).toBe(true)
  })

  it('does not match the admin panel', () => {
    expect(isPublicLivePath('/sharphawk/admin/events')).toBe(false)
    expect(isPublicLivePath('/admin')).toBe(false)
  })

  it('reserved list includes every new system word', () => {
    for (const word of ['login', 'register', 'privacy', 'terms', 'dpa', 'app', 'events']) {
      expect(RESERVED_TENANT_SUBDOMAINS.has(word)).toBe(true)
    }
  })

  it('scopes trailing segment to join only (rejects display/facilitator with extra segments)', () => {
    // display and facilitator must match exactly with no trailing segment
    expect(isPublicLivePath('/sharphawk/summer-summit/display/extra')).toBe(false)
    expect(isPublicLivePath('/sharphawk/summer-summit/facilitator/extra')).toBe(false)
    // join still accepts optional trailing segment (team)
    expect(isPublicLivePath('/sharphawk/summer-summit/join/red-team')).toBe(true)
  })
})
