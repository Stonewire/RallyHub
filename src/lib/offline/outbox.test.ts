import { describe, it, expect, vi } from 'vitest'

import { Outbox, PermanentSubmitError, type OutboxItem } from './outbox'

function item(clientId: string, overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    clientId,
    eventId: 'e1',
    teamId: 't1',
    kind: 'open-submission',
    gameId: 'g1',
    createdAt: '2026-08-12T00:00:00.000Z',
    payload: {},
    ...overrides,
  }
}

describe('Outbox', () => {
  it('drains queued items in FIFO order', async () => {
    const sent: string[] = []
    const box = new Outbox({ process: async (i) => void sent.push(i.clientId) })
    await box.enqueue(item('a'))
    await box.enqueue(item('b'))
    await box.enqueue(item('c'))
    // enqueue kicks the drain; let microtasks settle
    await new Promise((r) => setTimeout(r, 0))
    expect(sent).toEqual(['a', 'b', 'c'])
    expect(box.hasPending()).toBe(false)
  })

  it('does not drain while offline, drains once back online', async () => {
    const sent: string[] = []
    let online = false
    const box = new Outbox({
      process: async (i) => void sent.push(i.clientId),
      isOnline: () => online,
    })
    await box.enqueue(item('a'))
    await new Promise((r) => setTimeout(r, 0))
    expect(sent).toEqual([]) // stayed queued
    expect(box.hasPending()).toBe(true)
    online = true
    await box.drain()
    expect(sent).toEqual(['a'])
    expect(box.hasPending()).toBe(false)
  })

  it('retries a transient failure with backoff, then succeeds', async () => {
    const scheduled: Array<() => void> = []
    let attempts = 0
    const box = new Outbox({
      process: async () => {
        attempts += 1
        if (attempts < 2) throw new Error('network down')
      },
      backoffMs: [10],
      schedule: (fn) => void scheduled.push(fn),
    })
    await box.enqueue(item('a'))
    await new Promise((r) => setTimeout(r, 0))
    expect(attempts).toBe(1)
    expect(box.hasPending()).toBe(true) // still queued after the failure
    expect(scheduled).toHaveLength(1)
    scheduled[0]() // fire the retry
    await new Promise((r) => setTimeout(r, 0))
    expect(attempts).toBe(2)
    expect(box.hasPending()).toBe(false)
  })

  it('drops a permanent failure and continues to the next item', async () => {
    const sent: string[] = []
    const dropped: string[] = []
    const box = new Outbox({
      process: async (i) => {
        if (i.clientId === 'bad') throw new PermanentSubmitError('file too large')
        sent.push(i.clientId)
      },
      onDropped: (i) => void dropped.push(i.clientId),
    })
    await box.enqueue(item('bad'))
    await box.enqueue(item('good'))
    await new Promise((r) => setTimeout(r, 0))
    expect(dropped).toEqual(['bad'])
    expect(sent).toEqual(['good'])
    expect(box.hasPending()).toBe(false)
  })

  it('ignores a duplicate clientId enqueue', async () => {
    const sent: string[] = []
    const box = new Outbox({ process: async (i) => void sent.push(i.clientId), isOnline: () => false })
    await box.enqueue(item('a'))
    await box.enqueue(item('a'))
    expect(box.pending()).toHaveLength(1)
  })

  it('rehydrates from persistence on start and drains', async () => {
    const store = [item('x'), item('y')]
    const sent: string[] = []
    const box = new Outbox({
      process: async (i) => void sent.push(i.clientId),
      persistence: {
        load: async () => store,
        add: vi.fn(async () => {}),
        remove: vi.fn(async () => {}),
      },
    })
    await box.start()
    await new Promise((r) => setTimeout(r, 0))
    expect(sent).toEqual(['x', 'y'])
  })
})
