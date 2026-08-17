/*
 * RallyHub's service worker: installability plus offline boot.
 *
 * Two jobs. (1) Chromium will only offer to install a site whose worker can
 * answer a navigation offline. (2) OFFLINE-1: a player who joined an event and
 * then loses connection must be able to reopen the app; the joined data comes
 * from the IndexedDB bundle snapshot, and this worker supplies the app shell.
 *
 * Runtime caching only — no precache list to maintain:
 *  - /assets/*: cache-first. Vite content-hashes every filename, so a cached
 *    asset can never be stale; a new deploy has new names and old entries are
 *    swept below.
 *  - navigations: network-first, falling back to the last successfully served
 *    index.html, then offline.html. Network-first means a deploy is picked up
 *    on the very next online load — the old "stale JS mid-event" worry does
 *    not apply because the fallback only engages when there IS no network.
 *  - everything else (Supabase, realtime sockets, audio ranges, ffmpeg worker)
 *    is untouched.
 */

const CACHE = 'rallyhub-offline-v2'
const ASSETS = 'rallyhub-assets-v1'
const SHELL = 'rallyhub-shell-v1'
const OFFLINE_URL = '/offline.html'
// The offline submission queue keeps captured photo/video bytes in Cache API
// caches with this prefix (src/lib/offline/blob-cache.ts). The cleanup below
// must NEVER delete them: they are a player's queued, not-yet-uploaded
// submissions, and a service worker update mid-event would wipe them.
const PROTECTED_PREFIX = 'rallyhub-offline-blobs'
const KEEP = new Set([CACHE, ASSETS, SHELL])

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // cache: 'reload' so a stale HTTP-cached copy cannot be the one installed.
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !KEEP.has(key) && !key.startsWith(PROTECTED_PREFIX))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Hashed build assets: immutable by construction, so cache-first is safe and
  // fast. Old hashes accumulate only until the next activate sweep of a
  // renamed cache version.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request)
        if (hit) return hit
        const res = await fetch(request)
        if (res.ok) void cache.put(request, res.clone())
        return res
      }),
    )
    return
  }

  // Page loads: always prefer the network (a deploy lands on the next online
  // load); with no network, serve the last good shell so the app can boot and
  // render from its local data.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            void caches.open(SHELL).then((cache) => cache.put('/__shell', res.clone()))
          }
          return res
        })
        .catch(async () => {
          const shell = await (await caches.open(SHELL)).match('/__shell')
          if (shell) return shell
          const offline = await (await caches.open(CACHE)).match(OFFLINE_URL)
          return offline ?? Response.error()
        }),
    )
  }
})
