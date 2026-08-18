// Store catalogue + orders snapshot for offline browsing (OFFLINE-1 Stage 5).
//
// The store sheet reads this snapshot when its RPCs fail offline. It used to be
// written only on the sheet's own successful loads, so a team that never opened
// the store online saw an empty, erroring store offline. JoinGameView now
// downloads it right after join (alongside the answer package) and again on
// reconnect, so the store browses offline from the first drop.

import { supabase } from '@/lib/supabase'

import { idbGet, idbSet } from './idb'

export type StoreSnapshot = { rows: unknown[]; orders: unknown[] }

const contentKey = (eventId: string) => `store:${eventId}`

/** Fetch the catalogue and this team's orders, persist them for offline use,
 *  and return them. Returns null on any failure (offline, invalid token) and
 *  leaves the previously stored snapshot intact. */
export async function downloadStoreSnapshot(
  eventId: string,
  token: string,
): Promise<StoreSnapshot | null> {
  if (!token) return null
  const [storeRes, ordersRes] = await Promise.all([
    supabase.rpc('get_event_store', { p_event_id: eventId, p_purchase_token: token }),
    supabase.rpc('get_team_store_orders', { p_event_id: eventId, p_purchase_token: token }),
  ])
  if (storeRes.error) return null
  const snapshot: StoreSnapshot = {
    rows: storeRes.data ?? [],
    orders: ordersRes.error ? [] : (ordersRes.data ?? []),
  }
  await idbSet('content', contentKey(eventId), snapshot).catch(() => undefined)
  return snapshot
}

/** The last snapshot this device saw, or null. */
export async function getStoredStoreSnapshot(eventId: string): Promise<StoreSnapshot | null> {
  const snap = await idbGet<StoreSnapshot>('content', contentKey(eventId))
  return snap?.rows ? snap : null
}
