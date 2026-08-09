import { afterEach, describe, expect, it, vi } from 'vitest'

import { getCurrentAppOrigin } from '@/lib/app-origin'
import { getEventLinks } from '@/lib/event-links'
import { getInventoryItemLink } from '@/lib/inventory-links'
import { getTabletLink } from '@/lib/tablet-link'

const PREVIEW_ORIGIN = 'https://rally-hub-git-feature-links-stonewire-tech.vercel.app'

describe('branch-aware share links', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the domain of the page that is currently open', () => {
    vi.stubGlobal('window', { location: { origin: PREVIEW_ORIGIN } })

    expect(getCurrentAppOrigin()).toBe(PREVIEW_ORIGIN)
    expect(getEventLinks('event-123')).toEqual({
      facilitator: `${PREVIEW_ORIGIN}/facilitator/event-123`,
      display: `${PREVIEW_ORIGIN}/display/event-123`,
      join: `${PREVIEW_ORIGIN}/join/event-123`,
    })
  })

  it('keeps pretty event, inventory, and tablet links on the preview domain', () => {
    vi.stubGlobal('window', { location: { origin: `${PREVIEW_ORIGIN}/` } })

    expect(
      getEventLinks('event-123', { clientSlug: 'acme', eventSlug: 'summer-day' }),
    ).toEqual({
      facilitator: `${PREVIEW_ORIGIN}/acme/summer-day/facilitator`,
      display: `${PREVIEW_ORIGIN}/acme/summer-day/display`,
      join: `${PREVIEW_ORIGIN}/acme/summer-day/join`,
    })
    expect(getInventoryItemLink('item-code')).toBe(
      `${PREVIEW_ORIGIN}/inventory/item/item-code`,
    )
    expect(getTabletLink({ subdomain: 'acme' })).toBe(
      `${PREVIEW_ORIGIN}/acme/tablet`,
    )
  })
})
