// Backs the submission outbox with real storage so a queued submission survives
// going offline, a reload, or the app being killed (OFFLINE-1 Stage 3).
//
// The queue records live in IndexedDB (small, structured). Media blobs do NOT —
// WebKit has a memory-spike history with large blobs in IndexedDB — so a
// photo/video File is moved to the Cache API (which streams to disk) keyed by
// the item's clientId, and stripped from the persisted payload. On rehydrate the
// item carries a blobKey; processOutboxItem reloads it from the cache.

import { idbGetAll, idbSet, idbDelete } from './idb'
import { putBlob, deleteBlob, totalBlobBytes, storageHeadroomBytes } from './blob-cache'
import type { OutboxItem, OutboxPersistence } from './outbox'

// Cap the durable media queue so a run of large videos cannot fill storage and
// trigger origin-wide eviction of already-queued blobs. Over the cap, the item
// stays in-memory only (drains this session) rather than being persisted.
const MAX_QUEUE_BLOB_BYTES = 150 * 1024 * 1024
// Keep at least this much headroom free after adding, so we never push the
// origin to the edge of quota.
const MIN_HEADROOM_BYTES = 50 * 1024 * 1024
// Other events' undrained items older than this are pruned on load.
const STALE_MS = 48 * 60 * 60 * 1000

export function createOutboxPersistence(eventId: string, teamId: string): OutboxPersistence {
  return {
    load: async () => {
      const all = await idbGetAll<OutboxItem>('outbox')
      const mine: OutboxItem[] = []
      const now = Date.now()
      for (const item of all) {
        // Event AND team scoped: after a slot takeover the device may rejoin
        // the same event as a different team, and draining the old team's
        // items with the new team's token would be rejected by the write guard
        // and destroy them. A stale own-event other-team item just waits (its
        // token was rotated away, it can never send) until the prune.
        if (item.eventId === eventId && item.teamId === teamId) {
          mine.push(item)
          continue
        }
        // Prune a different event's leftover once it is clearly stale, freeing
        // its record and blob so a reused device does not accumulate storage.
        const age = now - Date.parse(item.createdAt || '')
        if (Number.isFinite(age) && age > STALE_MS) {
          await idbDelete('outbox', item.clientId)
          if (item.blobKey) await deleteBlob(item.blobKey)
        }
      }
      return mine
    },

    add: async (item) => {
      const file = (item.payload as { file?: unknown }).file
      if (!(file instanceof Blob)) {
        await idbSet('outbox', item.clientId, item)
        return
      }
      // Do not let the durable blob set grow without bound, and do not persist
      // when storage is too tight — either way the item stays in memory only.
      const [total, headroom] = await Promise.all([totalBlobBytes(), storageHeadroomBytes()])
      const overCap = total + file.size > MAX_QUEUE_BLOB_BYTES
      const tooTight = headroom !== null && headroom - file.size < MIN_HEADROOM_BYTES
      if (overCap || tooTight) return

      // Only record a blobKey once the blob is actually stored, so a reload can
      // never rehydrate an item pointing at a blob that was never written.
      const stored = await putBlob(item.clientId, file)
      if (!stored) return
      // Mark the live queued item too, so the in-session drain can fall back to
      // the cached blob if the in-memory File turns unreadable (iOS reclaims
      // camera temp files under memory pressure).
      item.blobKey = item.clientId
      const payload = { ...item.payload }
      delete (payload as { file?: unknown }).file
      await idbSet('outbox', item.clientId, { ...item, payload, blobKey: item.clientId })
    },

    remove: async (clientId) => {
      await idbDelete('outbox', clientId)
      await deleteBlob(clientId)
    },
  }
}
