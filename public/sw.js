/*
 * The smallest service worker that makes RallyHub installable.
 *
 * Chromium will only offer to install a site that registers a service worker
 * able to answer a navigation while offline, so one has to exist. It does not
 * have to cache the app, and here it deliberately does not: RallyHub is a live
 * event tool that is useless without Supabase, and a worker holding on to stale
 * JavaScript during an event is a far worse failure than a page that will not
 * load. Nothing but the offline notice is ever cached, and every request that
 * is not a top-level navigation is left alone entirely, so Supabase, realtime
 * sockets, audio range requests and the ffmpeg worker never pass through here.
 *
 * Bump CACHE when offline.html changes; the activate handler drops every other
 * cache, and skipWaiting plus claim mean a deploy takes over immediately rather
 * than leaving an old worker in charge of open tabs.
 */

const CACHE = 'rallyhub-offline-v1'
const OFFLINE_URL = '/offline.html'

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
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only page loads. Returning without calling respondWith hands the request
  // back to the browser untouched, which is what every other request wants.
  if (request.mode !== 'navigate' || request.method !== 'GET') return

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE)
      const offline = await cache.match(OFFLINE_URL)
      return offline ?? Response.error()
    }),
  )
})
