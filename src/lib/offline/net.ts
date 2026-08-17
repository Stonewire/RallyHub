// Online status for the offline kit: one non-hook check for the outbox and one
// subscription hook for UI. navigator.onLine can lie about a captive portal,
// but for showing/hiding offline UI it is the right level of truth — the
// outbox's retry/backoff machinery handles the lying cases.

import { useSyncExternalStore } from 'react'

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true)
}
