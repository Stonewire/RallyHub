/*
 * RallyHub's service worker: installability plus offline boot.
 *
 * Two jobs. (1) Chromium will only offer to install a site whose worker can
 * answer a navigation offline. (2) OFFLINE-1: a player who joined an event and
 * then loses connection must be able to reopen the app; the joined data comes
 * from the IndexedDB bundle snapshot, and this worker supplies the app shell.
 *
 * Mostly runtime caching; the only precache list is the small first-party
 * static media set below (P3.2):
 *  - /assets/*: cache-first. Vite content-hashes every filename, so a cached
 *    asset can never be stale; a new deploy has new names and old entries are
 *    swept below.
 *  - /sounds/* and the Powered by RallyHub badge: cache-first from a cache
 *    primed at install, so UI sounds play and the badge renders offline.
 *  - cross-origin images: stale-while-revalidate from the join-time event
 *    media cache (src/lib/offline/media-cache.ts), network on a miss, so game
 *    covers and brief images survive going offline yet a same-URL re-upload
 *    still reaches devices.
 *  - navigations: network-first, falling back to the last successfully served
 *    index.html, then offline.html. Network-first means a deploy is picked up
 *    on the very next online load — the old "stale JS mid-event" worry does
 *    not apply because the fallback only engages when there IS no network.
 *  - everything else (Supabase API, realtime sockets, audio ranges, ffmpeg
 *    worker) is untouched.
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
// First-party static media the live surfaces need offline (P3.2): the UI sound
// files and the Powered by RallyHub badge. Not content-hashed, so they version
// with the boot version and are primed at install (sounds load lazily, the key
// clicks only on the first key press, so runtime caching alone would miss them
// for a player who goes offline before ever triggering one).
const STATIC = 'rallyhub-static-' + OFFLINE_BOOT_VERSION
// Downloaded event media (game covers, brief images, logos), written at join
// by src/lib/offline/media-cache.ts and served below for image requests. The
// name MUST stay in KEEP or an SW update would wipe it.
const MEDIA = 'rallyhub-offline-media-v1'
const OFFLINE_URL = '/offline.html'
// The offline submission queue keeps captured photo/video bytes in Cache API
// caches with this prefix (src/lib/offline/blob-cache.ts). The cleanup below
// must NEVER delete them: they are a player's queued, not-yet-uploaded
// submissions, and a service worker update mid-event would wipe them.
const PROTECTED_PREFIX = 'rallyhub-offline-blobs'
const KEEP = new Set([CACHE, ASSETS, SHELL, STATIC, MEDIA])

// Keep this list in sync with src/lib/sounds.ts (files) and
// src/components/live/PoweredByRallyHub.tsx (the ?v= query is part of the
// cache key). A file missing here still gets runtime-cached on first online
// use by the /sounds/ + /powered-by- route below.
const STATIC_URLS = [
  '/powered-by-rallyhub-dark.svg?v=4',
  '/powered-by-rallyhub-light.svg?v=4',
  '/sounds/new-submission.mp3',
  '/sounds/submited-facilitator.mp3',
  '/sounds/new-message.mp3',
  '/sounds/announcement.mp3',
  '/sounds/quiz-select.mp3',
  '/sounds/quiz-correct.mp3',
  '/sounds/quiz-wrong.mp3',
  '/sounds/video-start.mp3',
  '/sounds/video-stop.mp3',
  '/sounds/Winner%20Announcement.mp3',
  '/sounds/bingo-winner.mp3',
  '/sounds/key-click-1.wav',
  '/sounds/key-click-2.wav',
  '/sounds/key-click-3.wav',
  '/sounds/key-space-1.wav',
  '/sounds/key-space-2.wav',
  '/sounds/key-backspace-1.wav',
  '/sounds/key-backspace-2.wav',
  '/sounds/key-submit.wav',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .open(CACHE)
        // cache: 'reload' so a stale HTTP-cached copy cannot be the one installed.
        .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))),
      // Static media primes best-effort, file by file: one missing sound must
      // not block install (cache.addAll would), it only stays online-only.
      caches.open(STATIC).then((cache) =>
        Promise.allSettled(
          STATIC_URLS.map(async (href) => {
            if (await cache.match(href)) return
            const res = await fetch(new Request(href, { cache: 'reload' }))
            if (res.ok && res.status === 200) await cache.put(href, res)
          }),
        ),
      ),
    ]),
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

// Media elements (iOS Safari especially) ask for audio with a Range header and
// expect a 206 back; a cached full response must be sliced to match or the
// sound silently fails to play offline. Files here are small (short mp3/wav
// cues), so buffering one to slice is fine.
async function withRange(response, request) {
  const rangeHeader = request.headers.get('range')
  if (!rangeHeader) return response
  const match = /bytes=(\d+)-(\d+)?/.exec(rangeHeader)
  if (!match) return response
  const body = await response.arrayBuffer()
  const start = Number(match[1])
  if (start >= body.byteLength) {
    return new Response(null, {
      status: 416,
      headers: { 'content-range': 'bytes */' + body.byteLength },
    })
  }
  const end = match[2] ? Math.min(Number(match[2]), body.byteLength - 1) : body.byteLength - 1
  const slice = body.slice(start, end + 1)
  return new Response(slice, {
    status: 206,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/octet-stream',
      'content-range': 'bytes ' + start + '-' + end + '/' + body.byteLength,
      'content-length': String(slice.byteLength),
      'accept-ranges': 'bytes',
    },
  })
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin !== self.location.origin) {
    // Cross-origin images (Supabase Storage game covers, brief images, logos):
    // stale-while-revalidate against the join-time media cache. The cached
    // copy answers immediately; while online, a background refetch with
    // cache: 'reload' overwrites the entry on success, because covers upload
    // to a stable path with upsert, so the bytes change under an unchanged
    // URL and a cache-first-forever policy served stale images for good.
    // Misses hit the network exactly as before. Only images: API, realtime
    // and audio-clip requests stay untouched. NEW entries are still only ever
    // written by the deliberate, capped download in media-cache.ts; the
    // revalidation here only replaces entries that already exist.
    if (request.destination === 'image') {
      event.respondWith(
        caches
          .open(MEDIA)
          .then(async (cache) => {
            const hit = await cache.match(request.url)
            if (hit) {
              if (navigator.onLine) {
                // Best-effort refresh: any failure (offline race, CORS, 4xx)
                // is swallowed and the stale copy simply stands.
                event.waitUntil(
                  fetch(new Request(request.url, { cache: 'reload' }))
                    .then((res) => {
                      if (res.ok) return cache.put(request.url, res)
                    })
                    .catch(() => undefined),
                )
              }
              return hit
            }
            return fetch(request)
          })
          // Cache API trouble (caches.open rejecting in private mode) must
          // degrade to a plain network image, never a failed request.
          .catch(() => fetch(request)),
      )
    }
    return
  }

  // First-party static media (UI sounds, the Powered by RallyHub badge):
  // cache-first from the install-primed cache, backfilling anything missing on
  // first online use. Freshness rides OFFLINE_BOOT_VERSION like the shell.
  if (url.pathname.startsWith('/sounds/') || url.pathname.startsWith('/powered-by-')) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(url.href)
        if (hit) return withRange(hit, request)
        // Fetch the FULL file regardless of any Range header so the copy that
        // lands in the cache is complete (a 206 is not cacheable), then answer
        // the range from it.
        const res = await fetch(url.href)
        if (res.ok && res.status === 200) {
          const copy = res.clone()
          event.waitUntil(cache.put(url.href, copy))
          return withRange(res, request)
        }
        return res
      }),
    )
    return
  }

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
