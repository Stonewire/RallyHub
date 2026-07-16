import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearCurrentParticipantSession,
  getCurrentParticipantSession,
  saveCurrentParticipantSession,
} from '@/lib/participant-session'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('current participant session', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    })
  })

  it('keeps the private purchase token when the same team session is refreshed', () => {
    saveCurrentParticipantSession('event-1', 'team-1', 'private-token')
    saveCurrentParticipantSession('event-1', 'team-1')

    expect(getCurrentParticipantSession()).toMatchObject({
      eventId: 'event-1',
      teamId: 'team-1',
      purchaseToken: 'private-token',
    })
  })

  it('does not carry a purchase token to a different team', () => {
    saveCurrentParticipantSession('event-1', 'team-1', 'private-token')
    saveCurrentParticipantSession('event-2', 'team-2')

    expect(getCurrentParticipantSession()).toMatchObject({
      eventId: 'event-2',
      teamId: 'team-2',
    })
    expect(getCurrentParticipantSession()?.purchaseToken).toBeUndefined()
  })

  it('only clears the matching event and team', () => {
    saveCurrentParticipantSession('event-1', 'team-1', 'private-token')
    clearCurrentParticipantSession('event-1', 'team-2')
    expect(getCurrentParticipantSession()).not.toBeNull()

    clearCurrentParticipantSession('event-1', 'team-1')
    expect(getCurrentParticipantSession()).toBeNull()
  })
})
