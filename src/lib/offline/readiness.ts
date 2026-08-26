// Offline readiness tracker (FIX-ROUND-1 P3.3).
//
// The player surface shows a small corner dot telling the team whether this
// device could carry on if the connection dropped right now: yellow while any
// offline download is running, green when everything the event needs offline
// is actually stored on the device, red when a download failed or cannot
// complete. Honesty is the point: green is decided by probing the stored
// artefacts (IndexedDB), never by "no download happens to be running".
//
// Each download path (answer package, store snapshot, bundle snapshot, and any
// future kind such as game-image caching) self-registers by reporting its own
// lifecycle: beginOfflineDownload(kind, eventId, isStored) marks it in flight
// and hands back a settle function; reportOfflineDownloadResult is the atomic
// form for fast local saves that should never flash the dot yellow. A kind the
// event never attempts (for example the store snapshot on a device with no
// purchase token) simply never reports, so it never blocks green.
//
// State is tracked per event id (slot takeover / rejoin safety) and lives in
// module memory only; a reload starts at 'syncing' until the join-time
// downloads report again and the probes confirm what survived in IndexedDB.

import { useCallback, useSyncExternalStore } from 'react'

export type OfflineReadinessState = 'syncing' | 'ready' | 'failed'

export type OfflineArtefactProbe = (eventId: string) => Promise<boolean>

/** One kind's view for the aggregate: is a download running, how did the last
 *  attempt end, and does the stored artefact actually exist right now. */
export type OfflineKindSnapshot = {
  inFlight: boolean
  lastOutcome: 'success' | 'failure' | null
  stored: boolean
}

/** The aggregate rule, pure so it is directly testable:
 *  - anything in flight -> syncing;
 *  - nothing attempted yet -> syncing (join-time downloads are about to run);
 *  - every attempted kind's artefact stored -> ready (a stale copy from an
 *    earlier session still means the device can play offline, even if the
 *    refresh just failed);
 *  - otherwise -> failed (a download failed, or storage is unavailable, or the
 *    device is offline with artefacts missing: it cannot complete either way). */
export function computeOfflineReadiness(kinds: OfflineKindSnapshot[]): OfflineReadinessState {
  if (kinds.some((k) => k.inFlight)) return 'syncing'
  if (kinds.length === 0) return 'syncing'
  if (kinds.every((k) => k.stored)) return 'ready'
  return 'failed'
}

type Entry = {
  inFlight: number
  lastOutcome: 'success' | 'failure' | null
  isStored: OfflineArtefactProbe | null
}

// eventId -> kind -> entry. Only kinds that actually reported for that event.
const entries = new Map<string, Map<string, Entry>>()
const snapshots = new Map<string, OfflineReadinessState>()
const listeners = new Set<() => void>()
// One evaluation per event at a time; reports landing mid-probe mark it dirty
// and it re-runs, so the settled snapshot always reflects the latest reports.
const running = new Map<string, Promise<void>>()
const dirty = new Set<string>()

function entryFor(eventId: string, kind: string): Entry {
  let byKind = entries.get(eventId)
  if (!byKind) {
    byKind = new Map()
    entries.set(eventId, byKind)
  }
  let entry = byKind.get(kind)
  if (!entry) {
    entry = { inFlight: 0, lastOutcome: null, isStored: null }
    byKind.set(kind, entry)
  }
  return entry
}

function setSnapshot(eventId: string, next: OfflineReadinessState): void {
  if (snapshots.get(eventId) === next) return
  snapshots.set(eventId, next)
  for (const listener of listeners) listener()
}

async function evaluate(eventId: string): Promise<void> {
  const byKind = entries.get(eventId)
  const kinds = byKind ? [...byKind.values()] : []
  if (kinds.some((e) => e.inFlight > 0)) {
    setSnapshot(eventId, 'syncing')
    return
  }
  const stored = await Promise.all(
    kinds.map(async (e) => {
      // No probe registered: fall back to trusting the reported outcome.
      if (!e.isStored) return e.lastOutcome === 'success'
      try {
        return await e.isStored(eventId)
      } catch {
        return false
      }
    }),
  )
  setSnapshot(
    eventId,
    computeOfflineReadiness(
      kinds.map((e, i) => ({ inFlight: false, lastOutcome: e.lastOutcome, stored: stored[i] })),
    ),
  )
}

function scheduleEvaluate(eventId: string): void {
  if (running.has(eventId)) {
    dirty.add(eventId)
    return
  }
  const p = evaluate(eventId)
    .catch(() => undefined)
    .finally(() => {
      running.delete(eventId)
      if (dirty.delete(eventId)) scheduleEvaluate(eventId)
    })
  running.set(eventId, p)
}

/** Mark one download kind in flight for an event. Returns the settle function;
 *  call it exactly once with whether the download succeeded. `isStored` is the
 *  honesty probe: does this kind's artefact for the event exist in storage. */
export function beginOfflineDownload(
  kind: string,
  eventId: string,
  isStored?: OfflineArtefactProbe,
): (ok: boolean) => void {
  const entry = entryFor(eventId, kind)
  if (isStored) entry.isStored = isStored
  entry.inFlight += 1
  scheduleEvaluate(eventId)
  let settled = false
  return (ok: boolean) => {
    if (settled) return
    settled = true
    entry.inFlight = Math.max(0, entry.inFlight - 1)
    entry.lastOutcome = ok ? 'success' : 'failure'
    scheduleEvaluate(eventId)
  }
}

/** Atomic report for fast local saves (for example the bundle snapshot, written
 *  every few seconds): records the outcome without an in-flight phase, so the
 *  dot never flashes yellow for a millisecond IndexedDB write. */
export function reportOfflineDownloadResult(
  kind: string,
  eventId: string,
  ok: boolean,
  isStored?: OfflineArtefactProbe,
): void {
  const entry = entryFor(eventId, kind)
  if (isStored) entry.isStored = isStored
  entry.lastOutcome = ok ? 'success' : 'failure'
  scheduleEvaluate(eventId)
}

/** Re-run the probes and refresh the aggregate (used on join and reconnect). */
export function refreshOfflineReadiness(eventId: string): void {
  scheduleEvaluate(eventId)
}

/** The current aggregate for an event; 'syncing' until first evaluated. */
export function getOfflineReadiness(eventId: string): OfflineReadinessState {
  return snapshots.get(eventId) ?? 'syncing'
}

/** Subscribe the player surface to the aggregate state for its event. Also
 *  re-evaluates on mount and when connectivity flips, so the dot stays honest
 *  after a reconnect even before the re-downloads report in. */
export function useOfflineReadiness(eventId: string): OfflineReadinessState {
  const subscribe = useCallback(
    (onChange: () => void) => {
      listeners.add(onChange)
      const revisit = () => refreshOfflineReadiness(eventId)
      window.addEventListener('online', revisit)
      window.addEventListener('offline', revisit)
      revisit()
      return () => {
        listeners.delete(onChange)
        window.removeEventListener('online', revisit)
        window.removeEventListener('offline', revisit)
      }
    },
    [eventId],
  )
  return useSyncExternalStore(
    subscribe,
    () => getOfflineReadiness(eventId),
    () => 'syncing' as const,
  )
}

/** For tests: wait until every scheduled evaluation (including dirty re-runs)
 *  has settled. */
export async function __flushOfflineReadinessForTests(): Promise<void> {
  while (running.size > 0) {
    await Promise.all([...running.values()])
  }
}

/** For tests: drop all tracked state. */
export function __resetOfflineReadinessForTests(): void {
  entries.clear()
  snapshots.clear()
  listeners.clear()
  running.clear()
  dirty.clear()
}
