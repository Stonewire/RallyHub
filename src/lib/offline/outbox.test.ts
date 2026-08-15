import { describe, it, expect, vi } from 'vitest'

import { Outbox, PermanentSubmitError, NetworkSubmitError, type OutboxItem } from './outbox'

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

  it('gives up after maxAttempts transient failures and drops the item', async () => {
    const scheduled: Array<() => void> = []
    const dropped: string[] = []
    let attempts = 0
    const box = new Outbox({
      process: async () => {
        attempts += 1
        throw new Error('always down')
      },
      backoffMs: [1],
      maxAttempts: 3,
      schedule: (fn) => void scheduled.push(fn),
      onDropped: (i) => void dropped.push(i.clientId),
    })
    await box.enqueue(item('a'))
    await new Promise((r) => setTimeout(r, 0))
    let guard = 0
    while (scheduled.length && guard++ < 10) {
      scheduled.shift()!()
      await new Promise((r) => setTimeout(r, 0))
    }
    expect(attempts).toBe(3)
    expect(dropped).toEqual(['a'])
    expect(box.hasPending()).toBe(false)
  })

  it('kick() forces a drain even while a retry is armed', async () => {
    const scheduled: Array<() => void> = []
    let fail = true
    const box = new Outbox({
      process: async () => {
        if (fail) throw new Error('down')
      },
      backoffMs: [10_000],
      schedule: (fn) => void scheduled.push(fn),
    })
    await box.enqueue(item('a'))
    await new Promise((r) => setTimeout(r, 0))
    expect(box.hasPending()).toBe(true) // failed once, armed for 10s
    fail = false
    box.kick() // connectivity back: ignore the backoff, retry now
    await new Promise((r) => setTimeout(r, 0))
    expect(box.hasPending()).toBe(false)
  })

  it('does NOT count NetworkSubmitError toward maxAttempts (survives a long outage)', async () => {
    const scheduled: Array<() => void> = []
    const dropped: string[] = []
    let calls = 0
    const box = new Outbox({
      process: async () => {
        calls += 1
        throw new NetworkSubmitError('connection down')
      },
      backoffMs: [1],
      maxAttempts: 3,
      schedule: (fn) => void scheduled.push(fn),
      onDropped: (i) => void dropped.push(i.clientId),
    })
    await box.enqueue(item('a'))
    await new Promise((r) => setTimeout(r, 0))
    for (let i = 0; i < 6 && scheduled.length; i++) {
      scheduled.shift()!()
      await new Promise((r) => setTimeout(r, 0))
    }
    expect(dropped).toEqual([]) // never dropped despite exceeding maxAttempts
    expect(box.hasPending()).toBe(true) // still queued, still retrying
    expect(calls).toBeGreaterThan(3)
  })

  it('enqueue keeps the item in memory and drains even if persistence.add rejects', async () => {
    const sent: string[] = []
    const box = new Outbox({
      process: async (i) => void sent.push(i.clientId),
      persistence: {
        load: async () => [],
        add: async () => {
          throw new Error('QuotaExceeded')
        },
        remove: async () => {},
      },
    })
    await box.enqueue(item('a'))
    await new Promise((r) => setTimeout(r, 0))
    expect(sent).toEqual(['a']) // drained despite the persistence failure
  })

  it('kick() neutralizes a previously-armed retry timer (no overlap, no cap burn)', async () => {
    const scheduled: Array<() => void> = []
    let calls = 0
    let fail = true
    const box = new Outbox({
      process: async () => {
        calls += 1
        if (fail) throw new Error('down')
      },
      backoffMs: [1000],
      schedule: (fn) => void scheduled.push(fn),
    })
    await box.enqueue(item('a'))
    await new Promise((r) => setTimeout(r, 0)) // attempt 1 fails -> Timer A armed
    expect(calls).toBe(1)
    fail = false
    box.kick() // reconnect: fresh generation, drain succeeds (attempt 2)
    await new Promise((r) => setTimeout(r, 0))
    expect(calls).toBe(2)
    expect(box.hasPending()).toBe(false)
    // Fire the STALE Timer A: it belonged to the old generation, so it must be
    // a no-op rather than a second overlapping drain.
    scheduled.forEach((fn) => fn())
    await new Promise((r) => setTimeout(r, 0))
    expect(calls).toBe(2)
  })

  it('stop() halts draining and neutralizes armed retries; queued items stay persisted', async () => {
    const scheduled: Array<() => void> = []
    const removed: string[] = []
    let calls = 0
    const box = new Outbox({
      process: async () => {
        calls += 1
        throw new NetworkSubmitError('down')
      },
      backoffMs: [1],
      schedule: (fn) => void scheduled.push(fn),
      persistence: {
        load: async () => [],
        add: async () => {},
        remove: async (id) => void removed.push(id),
      },
    })
    await box.enqueue(item('a'))
    await new Promise((r) => setTimeout(r, 0))
    expect(calls).toBe(1) // failed once, retry armed
    box.stop()
    scheduled.forEach((fn) => fn()) // stale timer must no-op
    await new Promise((r) => setTimeout(r, 0))
    expect(calls).toBe(1) // no zombie drain
    expect(removed).toEqual([]) // persisted copy left for the next mount
  })

  it('undoes a late persistence.add that lands after the item was delivered', async () => {
    const removed: string[] = []
    let releaseAdd: (() => void) | null = null
    const box = new Outbox({
      process: async () => {}, // delivers instantly
      persistence: {
        load: async () => [],
        add: () => new Promise<void>((res) => (releaseAdd = res)), // slow blob write
        remove: async (id) => void removed.push(id),
      },
    })
    await Promise.race([box.enqueue(item('a')), new Promise((r) => setTimeout(r, 10))])
    await new Promise((r) => setTimeout(r, 0))
    expect(box.hasPending()).toBe(false) // drained via the in-memory copy
    releaseAdd!() // the durable write lands late
    await new Promise((r) => setTimeout(r, 0))
    // removeItem ran once during drain, and the undo ran once after the late add
    expect(removed.filter((id) => id === 'a').length).toBeGreaterThanOrEqual(2)
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
