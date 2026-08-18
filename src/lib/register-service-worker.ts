/**
 * Registers the service worker that makes the app installable and, since
 * OFFLINE-1, able to boot with no connection (see public/sw.js).
 *
 * Production only: a worker sitting in front of the dev server fights with
 * Vite's HMR for no benefit, and installability is only ever exercised on a
 * real origin.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  // After load, so registration never competes with the first render.
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(async () => {
        // Prime the offline-boot caches with THIS page and the assets it
        // already loaded. The worker's fetch handler only sees requests made
        // after it controls a page, so without this a player's first session
        // (exactly when they join an event) would have no offline boot.
        const ready = await navigator.serviceWorker.ready
        const assets = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((name) => name.includes('/assets/'))
        ready.active?.postMessage({
          type: 'prime-offline-boot',
          url: window.location.pathname,
          assets,
        })
      })
      .catch((error: unknown) => {
        // Not fatal: without a worker the app still runs, it just cannot be
        // installed from Chromium's menu.
        console.warn('Service worker registration failed', error)
      })
  })
}
