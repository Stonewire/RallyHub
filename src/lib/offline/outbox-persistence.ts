// Backs the submission outbox with real storage so a queued submission survives
// going offline, a reload, or the app being killed (OFFLINE-1 Stage 3).
//
// The queue records live in IndexedDB (small, structured). Media blobs do NOT —
// WebKit has a memory-spike history with large blobs in IndexedDB — so a
// photo/video File is moved to the Cache API (which streams to disk) keyed by
// the item's clientId, and stripped from the persisted payload. On rehydrate the
// item carries a blobKey; processOutboxItem reloads the blob from the cache.

import { idbGetAll, idbSet, idbDelete } from './idb'
import { putBlob, deleteBlob } from './blob-cache'
import type { OutboxItem, OutboxPersistence } from './outbox'

export function createOutboxPersistence(eventId: string): OutboxPersistence {
  return {
    // Only this event's items: a device may hold queued items from a previous
    // event that this JoinGameView must not adopt or reconcile into its bundle.
    load: async () =>
      (await idbGetAll<OutboxItem>('outbox')).filter((i) => i.eventId === eventId),

    add: async (item) => {
      const file = (item.payload as { file?: unknown }).file
      if (file instanceof Blob) {
        // Move the blob out of the payload and into the Cache API; store the
        // rest of the item (a small, cleanly serialisable record) in IDB.
        await putBlob(item.clientId, file)
        const payload = { ...item.payload }
        delete (payload as { file?: unknown }).file
        await idbSet('outbox', item.clientId, { ...item, payload, blobKey: item.clientId })
      } else {
        await idbSet('outbox', item.clientId, item)
      }
    },

    remove: async (clientId) => {
      await idbDelete('outbox', clientId)
      await deleteBlob(clientId)
    },
  }
}
