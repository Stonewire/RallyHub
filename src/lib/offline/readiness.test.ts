import { describe, it, expect, beforeEach } from 'vitest'

import {
  computeOfflineReadiness,
  beginOfflineDownload,
  reportOfflineDownloadResult,
  refreshOfflineReadiness,
  getOfflineReadiness,
  __flushOfflineReadinessForTests,
  __resetOfflineReadinessForTests,
  type OfflineKindSnapshot,
} from './readiness'

function kind(overrides: Partial<OfflineKindSnapshot> = {}): OfflineKindSnapshot {
  return { inFlight: false, lastOutcome: 'success', stored: true, ...overrides }
}

describe('computeOfflineReadiness (aggregate rule)', () => {
  it('is syncing when nothing has been attempted yet', () => {
    expect(computeOfflineReadiness([])).toBe('syncing')
  })

  it('is syncing while any kind is in flight, even if others are stored', () => {
    expect(computeOfflineReadiness([kind(), kind({ inFlight: true, stored: false, lastOutcome: null })])).toBe(
      'syncing',
    )
  })

  it('is ready only when every attempted kind is actually stored', () => {
    expect(computeOfflineReadiness([kind(), kind()])).toBe('ready')
    expect(computeOfflineReadiness([kind(), kind({ stored: false })])).toBe('failed')
  })

  it('stays ready on a failed refresh when a stored copy from before exists', () => {
    expect(computeOfflineReadiness([kind({ lastOutcome: 'failure', stored: true })])).toBe('ready')
  })

  it('is failed when a download reported success but the artefact is missing (storage broken)', () => {
    expect(computeOfflineReadiness([kind({ lastOutcome: 'success', stored: false })])).toBe('failed')
  })

  it('is failed when a download failed and nothing is stored', () => {
    expect(computeOfflineReadiness([kind({ lastOutcome: 'failure', stored: false })])).toBe('failed')
  })
})

describe('offline readiness tracker', () => {
  beforeEach(() => {
    __resetOfflineReadinessForTests()
  })

  it('starts syncing before anything reports', () => {
    expect(getOfflineReadiness('e1')).toBe('syncing')
  })

  it('is syncing while a download is in flight', async () => {
    beginOfflineDownload('answer-package', 'e1', async () => false)
    await __flushOfflineReadinessForTests()
    expect(getOfflineReadiness('e1')).toBe('syncing')
  })

  it('goes green only when the probe confirms the artefact exists', async () => {
    const done = beginOfflineDownload('answer-package', 'e1', async () => true)
    done(true)
    await __flushOfflineReadinessForTests()
    expect(getOfflineReadiness('e1')).toBe('ready')
  })

  it('refuses green when the download claims success but the artefact is missing', async () => {
    const done = beginOfflineDownload('answer-package', 'e1', async () => false)
    done(true)
    await __flushOfflineReadinessForTests()
    expect(getOfflineReadiness('e1')).toBe('failed')
  })

  it('goes red on a failed download with nothing stored', async () => {
    const done = beginOfflineDownload('answer-package', 'e1', async () => false)
    done(false)
    await __flushOfflineReadinessForTests()
    expect(getOfflineReadiness('e1')).toBe('failed')
  })

  it('stays green on a failed refresh when the previous copy is still stored', async () => {
    const done = beginOfflineDownload('answer-package', 'e1', async () => true)
    done(false)
    await __flushOfflineReadinessForTests()
    expect(getOfflineReadiness('e1')).toBe('ready')
  })

  it('waits for every attempted kind before going green', async () => {
    const doneA = beginOfflineDownload('answer-package', 'e1', async () => true)
    const doneB = beginOfflineDownload('store-snapshot', 'e1', async () => true)
    doneA(true)
    await __flushOfflineReadinessForTests()
    expect(getOfflineReadiness('e1')).toBe('syncing')
    doneB(true)
    await __flushOfflineReadinessForTests()
    expect(getOfflineReadiness('e1')).toBe('ready')
  })

  it('a kind the event never attempts does not block green', async () => {
    // Only the answer package reports (no store on this device): green.
    const done = beginOfflineDownload('answer-package', 'e1', async () => true)
    done(true)
    await __flushOfflineReadinessForTests()
    expect(getOfflineReadiness('e1')).toBe('ready')
  })

  it('atomic result reports settle without an in-flight phase', async () => {
    reportOfflineDownloadResult('bundle-snapshot', 'e1', true, async () => true)
    await __flushOfflineReadinessForTests()
    expect(getOfflineReadiness('e1')).toBe('ready')
  })

  it('scopes state per event (slot takeover / rejoin safety)', async () => {
    const done = beginOfflineDownload('answer-package', 'e1', async () => false)
    done(false)
    await __flushOfflineReadinessForTests()
    expect(getOfflineReadiness('e1')).toBe('failed')
    expect(getOfflineReadiness('e2')).toBe('syncing')
  })

  it('re-evaluating on reconnect picks up artefacts that now exist', async () => {
    let stored = false
    const done = beginOfflineDownload('answer-package', 'e1', async () => stored)
    done(false)
    await __flushOfflineReadinessForTests()
    expect(getOfflineReadiness('e1')).toBe('failed')
    stored = true
    refreshOfflineReadiness('e1')
    await __flushOfflineReadinessForTests()
    expect(getOfflineReadiness('e1')).toBe('ready')
  })

  it('a report landing mid-probe still ends on the latest truth', async () => {
    const resolvers: ((v: boolean) => void)[] = []
    const slowProbe = () =>
      new Promise<boolean>((r) => {
        resolvers.push(r)
      })
    const until = async (cond: () => boolean) => {
      for (let i = 0; i < 100 && !cond(); i++) await new Promise((r) => setTimeout(r, 0))
      expect(cond()).toBe(true)
    }
    const doneA = beginOfflineDownload('answer-package', 'e1', slowProbe)
    doneA(true)
    await until(() => resolvers.length === 1) // evaluation is awaiting probe A
    const doneB = beginOfflineDownload('store-snapshot', 'e1', async () => true)
    doneB(true)
    resolvers[0](true) // the stale evaluation completes; the dirty re-run follows
    await until(() => resolvers.length === 2)
    resolvers[1](true)
    await __flushOfflineReadinessForTests()
    expect(getOfflineReadiness('e1')).toBe('ready')
  })

  it('ignores a settle function called twice', async () => {
    const done = beginOfflineDownload('answer-package', 'e1', async () => true)
    done(true)
    done(false)
    await __flushOfflineReadinessForTests()
    expect(getOfflineReadiness('e1')).toBe('ready')
  })

  it('treats a throwing probe as not stored', async () => {
    const done = beginOfflineDownload('answer-package', 'e1', async () => {
      throw new Error('idb unavailable')
    })
    done(true)
    await __flushOfflineReadinessForTests()
    expect(getOfflineReadiness('e1')).toBe('failed')
  })
})
