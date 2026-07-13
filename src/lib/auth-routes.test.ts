import { describe, expect, it } from 'vitest'

import { isAtLeastFacilitator } from '@/lib/auth-routes'

describe('isAtLeastFacilitator', () => {
  it('allows every organisation role that can run an event', () => {
    expect(isAtLeastFacilitator('facilitator')).toBe(true)
    expect(isAtLeastFacilitator('event_manager')).toBe(true)
    expect(isAtLeastFacilitator('client_admin')).toBe(true)
    expect(isAtLeastFacilitator('super_admin')).toBe(true)
  })

  it('does not allow an unknown or missing role', () => {
    expect(isAtLeastFacilitator(null)).toBe(false)
  })
})
