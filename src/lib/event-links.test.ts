import { describe, expect, it } from 'vitest'
import { getEventLinks } from '@/lib/event-links'

describe('getEventLinks', () => {
  it('builds the new short-form URLs when both slugs are present', () => {
    const links = getEventLinks('event-uuid', { clientSlug: 'sharphawk', eventSlug: 'summer-summit' })
    expect(links.join).toMatch(/\/sharphawk\/summer-summit\/join$/)
    expect(links.display).toMatch(/\/sharphawk\/summer-summit\/display$/)
    expect(links.facilitator).toMatch(/\/sharphawk\/summer-summit\/facilitator$/)
  })

  it('falls back to UUID routes when a slug is missing', () => {
    const links = getEventLinks('event-uuid', { clientSlug: 'sharphawk', eventSlug: null })
    expect(links.join).toMatch(/\/join\/event-uuid$/)
  })

  it('falls back to UUID routes when no opts are passed at all', () => {
    const links = getEventLinks('event-uuid')
    expect(links.join).toMatch(/\/join\/event-uuid$/)
    expect(links.display).toMatch(/\/display\/event-uuid$/)
    expect(links.facilitator).toMatch(/\/facilitator\/event-uuid$/)
  })
})
