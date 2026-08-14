// Media blobs (queued photo/video, downloaded cover/instruction images) live in
// the Cache API, not IndexedDB: the Cache API streams binary bodies to disk
// without holding the whole blob in memory, which is what WebKit wants for the
// tens-of-MB video clips an offline queue can hold. Keyed by an opaque string
// via a synthetic same-origin Request URL.

const CACHE_NAME = 'rallyhub-offline-blobs-v1'

function hasCache(): boolean {
  return typeof caches !== 'undefined'
}

function keyToRequest(key: string): string {
  // Same-origin, never actually fetched — just a stable cache key.
  return `/__offline-blob/${encodeURIComponent(key)}`
}

export async function putBlob(key: string, blob: Blob): Promise<void> {
  if (!hasCache()) return
  const cache = await caches.open(CACHE_NAME)
  // Preserve the content type so a retrieved video/photo uploads with the right
  // mime; store the original size in a header for quota accounting.
  await cache.put(
    keyToRequest(key),
    new Response(blob, {
      headers: {
        'content-type': blob.type || 'application/octet-stream',
        'x-blob-size': String(blob.size),
      },
    }),
  )
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  if (!hasCache()) return undefined
  const cache = await caches.open(CACHE_NAME)
  const res = await cache.match(keyToRequest(key))
  if (!res) return undefined
  return res.blob()
}

export async function deleteBlob(key: string): Promise<void> {
  if (!hasCache()) return
  const cache = await caches.open(CACHE_NAME)
  await cache.delete(keyToRequest(key))
}

/** Total bytes currently held, from the stored size headers. Cheap enough to
 *  call before queuing another video to enforce the cap. */
export async function totalBlobBytes(): Promise<number> {
  if (!hasCache()) return 0
  const cache = await caches.open(CACHE_NAME)
  const keys = await cache.keys()
  let total = 0
  for (const req of keys) {
    const res = await cache.match(req)
    total += Number(res?.headers.get('x-blob-size') ?? 0)
  }
  return total
}

/** Storage headroom via the Storage Manager estimate. Returns null when the API
 *  is missing (older Safari) so callers fall back to the byte cap alone. */
export async function storageHeadroomBytes(): Promise<number | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
  const { quota = 0, usage = 0 } = await navigator.storage.estimate()
  return Math.max(0, quota - usage)
}
