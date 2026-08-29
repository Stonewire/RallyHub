// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import {
  eventManagerAllowedAdminPath,
  facilitatorAllowedAdminPath,
  isAtLeastFacilitator,
  wrongDomainRedirectUrl,
} from '@/lib/auth-routes'

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

describe('eventManagerAllowedAdminPath', () => {
  it('allows the personal settings page the header avatar links to', () => {
    expect(eventManagerAllowedAdminPath('/admin/settings')).toBe(true)
    expect(eventManagerAllowedAdminPath('/admin/settings/')).toBe(true)
  })

  it('keeps org-level settings subpaths blocked', () => {
    expect(eventManagerAllowedAdminPath('/admin/settings/organization')).toBe(false)
    expect(eventManagerAllowedAdminPath('/admin/settings/billing')).toBe(false)
  })

  it('allows the working surfaces and nothing beyond them', () => {
    expect(eventManagerAllowedAdminPath('/admin')).toBe(true)
    expect(eventManagerAllowedAdminPath('/admin/events')).toBe(true)
    expect(eventManagerAllowedAdminPath('/admin/games')).toBe(true)
    expect(eventManagerAllowedAdminPath('/admin/support')).toBe(true)
    expect(eventManagerAllowedAdminPath('/admin/team')).toBe(true)
    expect(eventManagerAllowedAdminPath('/admin/clients')).toBe(false)
    expect(eventManagerAllowedAdminPath('/admin/payments')).toBe(false)
  })
})

describe('facilitatorAllowedAdminPath', () => {
  it('allows the events list and personal settings only', () => {
    expect(facilitatorAllowedAdminPath('/admin')).toBe(true)
    expect(facilitatorAllowedAdminPath('/admin/events')).toBe(true)
    expect(facilitatorAllowedAdminPath('/admin/settings')).toBe(true)
    expect(facilitatorAllowedAdminPath('/admin/settings/billing')).toBe(false)
    expect(facilitatorAllowedAdminPath('/admin/games')).toBe(false)
  })
})

describe('wrongDomainRedirectUrl', () => {
  const realLocation = window.location

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: realLocation, writable: true })
  })

  function stubHost(hostname: string) {
    Object.defineProperty(window, 'location', {
      value: { ...realLocation, hostname },
      writable: true,
    })
  }

  it('rejects a super_admin session on the app domain', () => {
    stubHost('app.rallyhub.games')
    expect(wrongDomainRedirectUrl('super_admin')).toBe('https://admin.rallyhub.games/login')
  })

  it('keeps the super_admin direction a bare jump link even with an identifier', () => {
    stubHost('app.rallyhub.games')
    expect(wrongDomainRedirectUrl('super_admin', 'boss@rallyhub.games')).toBe(
      'https://admin.rallyhub.games/login',
    )
  })

  it('rejects a client_admin session on the admin domain with a carry-across URL', () => {
    stubHost('admin.rallyhub.games')
    expect(wrongDomainRedirectUrl('client_admin')).toBe(
      'https://app.rallyhub.games/login?from=admin-domain',
    )
  })

  it('carries the typed identifier across url-encoded, never a password param', () => {
    stubHost('admin.rallyhub.games')
    expect(wrongDomainRedirectUrl('client_admin', 'anna@corp.example')).toBe(
      'https://app.rallyhub.games/login?from=admin-domain&identifier=anna%40corp.example',
    )
  })

  it('omits the identifier param when the identifier is empty', () => {
    stubHost('admin.rallyhub.games')
    expect(wrongDomainRedirectUrl('event_manager', '')).toBe(
      'https://app.rallyhub.games/login?from=admin-domain',
    )
  })

  it('allows a super_admin session on the admin domain', () => {
    stubHost('admin.rallyhub.games')
    expect(wrongDomainRedirectUrl('super_admin')).toBeNull()
  })

  it('allows a client role session on the app domain', () => {
    stubHost('app.rallyhub.games')
    expect(wrongDomainRedirectUrl('facilitator')).toBeNull()
  })

  it('allows any role on localhost (dev)', () => {
    stubHost('localhost')
    expect(wrongDomainRedirectUrl('super_admin')).toBeNull()
    expect(wrongDomainRedirectUrl('client_admin')).toBeNull()
  })
})
