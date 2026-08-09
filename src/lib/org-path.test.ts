import { describe, expect, it } from 'vitest'
import { orgPath } from '@/lib/org-path'

describe('orgPath', () => {
  it('prefixes an absolute path with the client slug', () => {
    expect(orgPath('sharphawk', '/admin/events')).toBe('/sharphawk/admin/events')
  })

  it('adds a leading slash to a path missing one', () => {
    expect(orgPath('sharphawk', 'admin/events')).toBe('/sharphawk/admin/events')
  })

  it('returns the path unchanged when the slug is null (super-admin, no clientSlug in scope)', () => {
    expect(orgPath(null, '/admin/events')).toBe('/admin/events')
  })

  it('returns the path unchanged when the slug is undefined', () => {
    expect(orgPath(undefined, '/admin/events')).toBe('/admin/events')
  })

  it('collapses a double slash if the path already starts with the slug boundary correctly', () => {
    expect(orgPath('sharphawk', '/')).toBe('/sharphawk/')
  })
})
