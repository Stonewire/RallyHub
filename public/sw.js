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
// SHELL and ASSETS share one version and MUST be bumped together, only ever
// via OFFLINE_BOOT_VERSION: a shell that survives while its referenced hashed
// assets are swept boots into a white screen offline, which is strictly worse
// than offline.html. Bumping both at once degrades a stale offline boot to
// offline.html until the next online load, which is the acceptable path. This
// is also the cleanup for accumulated old assets (a few MB per deploy).
const OFFLINE_BOOT_VERSION = 'v1'
const ASSETS = 'rallyhub-assets-' + OFFLINE_BOOT_VERSION
const SHELL = 'rallyhub-shell-' + OFFLINE_BOOT_VERSION
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
  // fast. Cleanup happens only via the coupled OFFLINE_BOOT_VERSION bump.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request)
        if (hit) return hit
        const res = await fetch(request)
        if (res.ok) {
          const copy = res.clone()
          event.waitUntil(cache.put(request, copy))
        }
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
          // Clone BEFORE the body is handed to the page, and only ever cache a
          // real HTML document — an ok non-HTML navigation must not poison the
          // boot shell. waitUntil keeps the worker alive through the put.
          if (res.ok && (res.headers.get('content-type') ?? '').includes('text/html')) {
            const copy = res.clone()
            event.waitUntil(caches.open(SHELL).then((cache) => cache.put('/__shell', copy)))
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

// First-visit priming (the page posts this once after the worker activates):
// without it, the fetch handler only caches what loads AFTER the worker
// controls the page, so a player's very first session had no offline boot.
self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'prime-offline-boot') return
  event.waitUntil(
    (async () => {
      try {
        const shellCache = await caches.open(SHELL)
        const res = await fetch(new Request(data.url || '/', { cache: 'reload' }))
        if (res.ok && (res.headers.get('content-type') ?? '').includes('text/html')) {
          await shellCache.put('/__shell', res)
        }
        const assetCache = await caches.open(ASSETS)
        for (const href of Array.isArray(data.assets) ? data.assets : []) {
          try {
            const u = new URL(href, self.location.origin)
            if (u.origin !== self.location.origin || !u.pathname.startsWith('/assets/')) continue
            if (await assetCache.match(u.href)) continue
            const r = await fetch(u.href)
            if (r.ok) await assetCache.put(u.href, r)
          } catch {
            // Skip an asset that will not fetch; the rest still prime.
          }
        }
      } catch {
        // Priming is best-effort; the runtime caching still covers later loads.
      }
    })(),
  )
})
