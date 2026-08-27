// Store catalogue + orders snapshot for offline browsing (OFFLINE-1 Stage 5).
//
// The store sheet reads this snapshot when its RPCs fail offline. It used to be
// written only on the sheet's own successful loads, so a team that never opened
// the store online saw an empty, erroring store offline. JoinGameView now
// downloads it right after join (alongside the answer package) and again on
// reconnect, so the store browses offline from the first drop.

import { supabase } from '@/lib/supabase'

import { idbGet, idbSet } from './idb'
import {
  beginOfflineDownload,
  reportOfflineDownloadResult,
  type OfflineArtefactProbe,
} from './readiness'

export type StoreSnapshot = { rows: unknown[]; orders: unknown[] }

const contentKey = (eventId: string) => `store:${eventId}`

/** Fetch the catalogue and this team's orders, persist them for offline use,
 *  and return them. Returns null on any failure (offline, invalid token) and
 *  leaves the previously stored snapshot intact.
 *
 *  Only the offline-readiness paths (JoinGameView's join-time and reconnect
 *  downloads) pass reportReadiness to drive the dot's begin/settle lifecycle.
 *  The store sheet calls this every 10 seconds while open as its orders poll;
 *  those routine polls must not pulse the dot amber or cycle its state
 *  offline, so without the option a run reports at most an atomic success
 *  (which can honestly heal a red dot: the snapshot IS now stored) and a
 *  failure is not reported at all. */
export async function downloadStoreSnapshot(
  eventId: string,
  token: string,
  options?: { reportReadiness?: boolean },
): Promise<StoreSnapshot | null> {
  // No token means this device cannot have a store: not an attempt, so it is
  // never reported to the readiness tracker and never blocks the green dot.
  if (!token) return null
  const done =
    options?.reportReadiness === true
      ? beginOfflineDownload('store-snapshot', eventId, hasStoredStoreSnapshot)
      : null
  try {
    const [storeRes, ordersRes] = await Promise.all([
      supabase.rpc('get_event_store', { p_event_id: eventId, p_purchase_token: token }),
      supabase.rpc('get_team_store_orders', { p_event_id: eventId, p_purchase_token: token }),
    ])
    if (storeRes.error) {
      done?.(false)
      return null
    }
    const snapshot: StoreSnapshot = {
      rows: storeRes.data ?? [],
      orders: ordersRes.error ? [] : (ordersRes.data ?? []),
    }
    await idbSet('content', contentKey(eventId), snapshot).catch(() => undefined)
    if (done) done(true)
    else reportOfflineDownloadResult('store-snapshot', eventId, true, hasStoredStoreSnapshot)
    return snapshot
  } catch {
    done?.(false)
    return null
  }
}

/** Readiness probe: is a store snapshot for this event actually stored. */
const hasStoredStoreSnapshot: OfflineArtefactProbe = async (eventId) =>
  (await getStoredStoreSnapshot(eventId)) !== null

/** The last snapshot this device saw, or null. */
export async function getStoredStoreSnapshot(eventId: string): Promise<StoreSnapshot | null> {
  const snap = await idbGet<StoreSnapshot>('content', contentKey(eventId))
  return snap?.rows ? snap : null
}
