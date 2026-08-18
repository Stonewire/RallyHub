// A tiny promise wrapper over IndexedDB — just what offline mode needs, no
// dependency. Three object stores, all keyed by a string:
//   outbox   — queued submissions/orders (key: clientId)
//   content  — the downloaded quest package per event (key: eventId)
//   meta     — small kv (download state, package version, etc.)
//
// IndexedDB is the right home for the queue index and metadata (small, indexed,
// survives reload/kill). Large media blobs do NOT go here — WebKit has a memory
// spike history with big blobs in IDB — they live in the Cache API (blob-cache.ts).

export type StoreName = 'outbox' | 'content' | 'meta'

const DB_NAME = 'rallyhub-offline'
const DB_VERSION = 1
const STORES: StoreName[] = ['outbox', 'content', 'meta']

let dbPromise: Promise<IDBDatabase> | null = null

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  const attempt = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    // If another tab holds an upgrade open, don't hang forever.
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'))
  })
  // Never cache a failed open: iOS Safari is known to flake on the first open
  // after launch, and a cached rejection would poison every IDB call for the
  // rest of the session (no answer keys, no queue persistence). Clearing the
  // cache lets the next call retry with a fresh open.
  attempt.catch(() => {
    if (dbPromise === attempt) dbPromise = null
  })
  dbPromise = attempt
  return attempt
}

function tx<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = run(t.objectStore(store))
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

/** Read one value, or undefined. Returns undefined (never throws) when IndexedDB
 *  is unavailable (private mode, ancient browser) so callers degrade gracefully. */
export async function idbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  if (!hasIndexedDB()) return undefined
  try {
    return await tx<T>(store, 'readonly', (s) => s.get(key) as IDBRequest<T>)
  } catch {
    return undefined
  }
}

/** Every value in a store, in insertion order (IDB getAll preserves key order,
 *  and our outbox keys are time-ordered UUIDs inserted in FIFO sequence). */
export async function idbGetAll<T>(store: StoreName): Promise<T[]> {
  if (!hasIndexedDB()) return []
  try {
    return await tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)
  } catch {
    return []
  }
}

export async function idbSet(store: StoreName, key: string, value: unknown): Promise<void> {
  if (!hasIndexedDB()) return
  await tx(store, 'readwrite', (s) => s.put(value, key))
}

export async function idbDelete(store: StoreName, key: string): Promise<void> {
  if (!hasIndexedDB()) return
  try {
    await tx(store, 'readwrite', (s) => s.delete(key))
  } catch {
    // A missing key is not an error worth surfacing.
  }
}

export async function idbClear(store: StoreName): Promise<void> {
  if (!hasIndexedDB()) return
  await tx(store, 'readwrite', (s) => s.clear())
}

/** For tests: drop the cached connection so a fresh openDb runs. */
export function __resetIdbForTests(): void {
  dbPromise = null
}
