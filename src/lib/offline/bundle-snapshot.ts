// The last-good LiveEventBundle, persisted so a reload with no connection can
// still show the joined player their event (OFFLINE-1 Stage 6). Combined with
// the service worker's runtime app-shell caching, the app then boots offline.
//
// The bundle is plain JSON (Supabase rows + jsonb config), so structured clone
// handles it. Saved debounced from useLiveEvent's single state choke point,
// which captures the initial fetch, every realtime patch, the safety poll and
// optimistic updates alike.

import type { LiveEventBundle } from '@/lib/live-event'

import { idbGet, idbHasKey, idbSet } from './idb'
import { reportOfflineDownloadResult, type OfflineArtefactProbe } from './readiness'

const key = (eventId: string) => `bundle:${eventId}`

/** Readiness probe: is a bundle snapshot for this event actually stored. A
 *  key-existence check only: the stored bundle is large (teams, games, up to
 *  1000 submissions) and deserialising the whole record on every readiness
 *  evaluation was pure waste. */
const hasStoredBundleSnapshot: OfflineArtefactProbe = async (eventId) =>
  idbHasKey('content', key(eventId))

export async function saveBundleSnapshot(eventId: string, bundle: LiveEventBundle): Promise<void> {
  try {
    await idbSet('content', key(eventId), { bundle, savedAt: new Date().toISOString() })
    // Atomic report (no in-flight phase): this runs every few seconds and must
    // never flash the readiness dot yellow for a millisecond IndexedDB write.
    reportOfflineDownloadResult('bundle-snapshot', eventId, true, hasStoredBundleSnapshot)
  } catch {
    // Best-effort: no snapshot just means no offline boot for this event.
    reportOfflineDownloadResult('bundle-snapshot', eventId, false, hasStoredBundleSnapshot)
  }
}

export async function loadBundleSnapshot(eventId: string): Promise<LiveEventBundle | null> {
  const rec = await idbGet<{ bundle: LiveEventBundle }>('content', key(eventId))
  return rec?.bundle ?? null
}
