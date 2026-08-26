import { useEffect } from 'react'

/**
 * Keeps the device screen awake while a live surface is mounted, using the
 * Screen Wake Lock API. The lock is requested on mount and re-acquired when
 * the document becomes visible again, because the browser auto releases it
 * whenever the tab hides. Released on unmount.
 *
 * Everything is best effort and fully silent: unsupported browsers, permission
 * denials and platform refusals (for example battery saver) are all no-ops.
 * Live surfaces must never surface an error for this.
 */
export function useWakeLock() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

    let active = true
    let requesting = false
    let sentinel: WakeLockSentinel | null = null

    const acquire = async () => {
      if (requesting) return
      if (sentinel && !sentinel.released) return
      requesting = true
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (!active) {
          lock.release().catch(() => {})
          return
        }
        sentinel = lock
      } catch {
        // Swallow silently: the surface works fine without the lock.
      } finally {
        requesting = false
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisibilityChange)
      sentinel?.release().catch(() => {})
      sentinel = null
    }
  }, [])
}
