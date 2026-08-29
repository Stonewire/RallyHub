// R2.5: what a device must forget when a slot it holds data for is claimed.
//
// A facilitator reset clears the server rows but keeps the teams row id, so
// every device-side record keyed by that id survives it. These are the two
// rules that decide which of those records are honoured and which are binned;
// both are pure, so the reset behaviour is testable without IndexedDB.

import { describe, it, expect } from 'vitest'

import { queuedItemsForSlot } from './outbox-persistence'
import type { OutboxItem, OutboxKind } from './outbox'
import { localPuzzleKeysForTeam } from './puzzle-local'

const EVENT = '11111111-1111-4111-8111-111111111111'
const OTHER_EVENT = '22222222-2222-4222-8222-222222222222'
const SLOT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_SLOT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function item(
  overrides: Partial<OutboxItem> & { clientId: string; kind: OutboxKind },
): OutboxItem {
  return {
    eventId: EVENT,
    teamId: SLOT,
    gameId: 'game-1',
    createdAt: '2026-08-29T10:00:00.000Z',
    payload: {},
    ...overrides,
  }
}

describe('localPuzzleKeysForTeam (which local puzzle records are honoured)', () => {
  const keys = [
    `puzzle:${EVENT}:${SLOT}:game-1`,
    `puzzle:${EVENT}:${SLOT}:game-2`,
    `puzzle:${EVENT}:${OTHER_SLOT}:game-1`,
    `puzzle:${OTHER_EVENT}:${SLOT}:game-1`,
    `answers:${EVENT}`,
    `bundle:${EVENT}`,
    `store:${EVENT}`,
  ]

  it('discards every record for the claimed slot on this event', () => {
    expect(localPuzzleKeysForTeam(keys, EVENT, SLOT)).toEqual([
      `puzzle:${EVENT}:${SLOT}:game-1`,
      `puzzle:${EVENT}:${SLOT}:game-2`,
    ])
  })

  it('honours another slot, another event, and the shared content namespaces', () => {
    const discarded = new Set(localPuzzleKeysForTeam(keys, EVENT, SLOT))
    expect(keys.filter((key) => !discarded.has(key))).toEqual([
      `puzzle:${EVENT}:${OTHER_SLOT}:game-1`,
      `puzzle:${OTHER_EVENT}:${SLOT}:game-1`,
      `answers:${EVENT}`,
      `bundle:${EVENT}`,
      `store:${EVENT}`,
    ])
  })

  it('matches whole id segments only, never a prefix of a longer id', () => {
    const nearMisses = [`puzzle:${EVENT}:${SLOT}extra:game-1`, `puzzle:${EVENT}x:${SLOT}:game-1`]
    expect(localPuzzleKeysForTeam(nearMisses, EVENT, SLOT)).toEqual([])
  })

  it('is a no-op for a device that never played this slot', () => {
    expect(localPuzzleKeysForTeam([], EVENT, SLOT)).toEqual([])
    expect(localPuzzleKeysForTeam([`answers:${EVENT}`], EVENT, SLOT)).toEqual([])
  })
})

describe('queuedItemsForSlot (which queued items rehydrate)', () => {
  const queue = [
    item({ clientId: 'open-1', kind: 'open-submission' }),
    item({ clientId: 'puzzle-1', kind: 'puzzle-result' }),
    item({ clientId: 'order-1', kind: 'store-order' }),
    item({ clientId: 'other-slot', kind: 'open-submission', teamId: OTHER_SLOT }),
    item({ clientId: 'other-event', kind: 'open-submission', eventId: OTHER_EVENT }),
  ]

  it('picks all three kinds queued under the slot, and nothing else', () => {
    expect(queuedItemsForSlot(queue, EVENT, SLOT).map((i) => i.clientId)).toEqual([
      'open-1',
      'puzzle-1',
      'order-1',
    ])
  })

  it('leaves the same event under another slot alone', () => {
    expect(queuedItemsForSlot(queue, EVENT, OTHER_SLOT).map((i) => i.clientId)).toEqual([
      'other-slot',
    ])
  })

  it('leaves another event alone even under the same team id', () => {
    expect(queuedItemsForSlot(queue, OTHER_EVENT, SLOT).map((i) => i.clientId)).toEqual([
      'other-event',
    ])
  })

  it('after the claim-time discard the new team rehydrates an empty queue', () => {
    // The discard bins exactly what the rehydration filter would have picked
    // up, so the old team's work cannot drain under the new team's token.
    const discarded = new Set(queuedItemsForSlot(queue, EVENT, SLOT).map((i) => i.clientId))
    const remaining = queue.filter((i) => !discarded.has(i.clientId))
    expect(queuedItemsForSlot(remaining, EVENT, SLOT)).toEqual([])
    // Other slots and events survive the bin untouched.
    expect(remaining.map((i) => i.clientId)).toEqual(['other-slot', 'other-event'])
  })
})
