import { describe, expect, it } from 'vitest'

import { buildSearchResults } from '@/lib/global-search'

const input = {
  games: [{ id: 'g1', name: 'Photo Hunt' }],
  events: [{ id: 'e1', name: 'Summer Rally' }],
  tickets: [{ id: 't1', subject: 'Cannot upload' }],
}

describe('buildSearchResults', () => {
  it('maps every source into tagged results with routes', () => {
    const results = buildSearchResults(input, 'client_admin')

    expect(results).toEqual([
      { id: 'g1', kind: 'game', label: 'Photo Hunt', to: '/admin/games/g1' },
      { id: 'e1', kind: 'event', label: 'Summer Rally', to: '/admin/events/e1' },
      {
        id: 't1',
        kind: 'ticket',
        label: 'Cannot upload',
        to: '/admin/support?ticket=t1',
      },
    ])
  })

  it('gives facilitators events only, since they cannot reach games or support', () => {
    const results = buildSearchResults(input, 'facilitator')

    expect(results).toEqual([
      { id: 'e1', kind: 'event', label: 'Summer Rally', to: '/admin/events/e1' },
    ])
  })

  it('returns an empty list when nothing matched', () => {
    expect(
      buildSearchResults({ games: [], events: [], tickets: [] }, 'client_admin'),
    ).toEqual([])
  })
})
