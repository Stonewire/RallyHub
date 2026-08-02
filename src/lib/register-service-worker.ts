/**
 * Registers the service worker that makes the app installable.
 *
 * Production only: a worker sitting in front of the dev server fights with
 * Vite's HMR for no benefit, and installability is only ever exercised on a
 * real origin. See public/sw.js for what it does, which is deliberately almost
 * nothing.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  // After load, so registration never competes with the first render.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      // Not fatal: without a worker the app still runs, it just cannot be
      // installed from Chromium's menu.
      console.warn('Service worker registration failed', error)
    })
  })
}
