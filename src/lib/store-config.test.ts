import { describe, expect, it } from 'vitest'

import { parseStoreConfig } from '@/lib/event-form-utils'

describe('parseStoreConfig', () => {
  it('reads well-formed rows', () => {
    expect(
      parseStoreConfig([{ itemId: 'a', totalStock: 12, perTeamLimit: 2 }]),
    ).toEqual([{ itemId: 'a', totalStock: 12, perTeamLimit: 2 }])
  })

  it('treats a missing store as empty', () => {
    expect(parseStoreConfig(null)).toEqual([])
    expect(parseStoreConfig(undefined)).toEqual([])
    expect(parseStoreConfig({} as never)).toEqual([])
  })

  it('drops entries with no item id rather than crashing the designer', () => {
    expect(parseStoreConfig([{ totalStock: 3 }, null, 'nonsense'] as never)).toEqual([])
  })

  it('clamps nonsense numbers to safe values', () => {
    expect(
      parseStoreConfig([{ itemId: 'a', totalStock: -5, perTeamLimit: 0 }]),
    ).toEqual([{ itemId: 'a', totalStock: 0, perTeamLimit: 1 }])
    // A per-team limit below one would put an item in the store that nobody
    // could ever buy.
    expect(parseStoreConfig([{ itemId: 'b' }] as never)).toEqual([
      { itemId: 'b', totalStock: 0, perTeamLimit: 1 },
    ])
  })

  it('floors fractional counts', () => {
    expect(
      parseStoreConfig([{ itemId: 'a', totalStock: 4.9, perTeamLimit: 2.7 }]),
    ).toEqual([{ itemId: 'a', totalStock: 4, perTeamLimit: 2 }])
  })
})
