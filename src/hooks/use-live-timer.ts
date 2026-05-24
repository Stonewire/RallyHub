import { useEffect, useRef, useState } from 'react'

/**
 * Local countdown synced to Supabase on tick (throttled by caller).
 * Only resyncs from server when paused or when drift exceeds threshold.
 */
export function useLiveTimer(
  serverSeconds: number,
  serverRunning: boolean,
  onTick: (next: number, stillRunning: boolean) => void | Promise<void>,
  options?: { syncThreshold?: number },
) {
  const syncThreshold = options?.syncThreshold ?? 2
  const [displaySeconds, setDisplaySeconds] = useState(serverSeconds)
  const onTickRef = useRef(onTick)
  onTickRef.current = onTick
  const localRef = useRef(serverSeconds)

  useEffect(() => {
    localRef.current = displaySeconds
  }, [displaySeconds])

  useEffect(() => {
    if (!serverRunning) {
      setDisplaySeconds(serverSeconds)
      localRef.current = serverSeconds
      return
    }
    const drift = Math.abs(serverSeconds - localRef.current)
    if (drift > syncThreshold) {
      setDisplaySeconds(serverSeconds)
      localRef.current = serverSeconds
    }
  }, [serverSeconds, serverRunning, syncThreshold])

  useEffect(() => {
    if (!serverRunning) return

    const id = window.setInterval(() => {
      setDisplaySeconds((prev) => {
        if (prev <= 0) {
          void onTickRef.current(0, false)
          return 0
        }
        const next = prev - 1
        void onTickRef.current(next, next > 0)
        return next
      })
    }, 1000)

    return () => window.clearInterval(id)
  }, [serverRunning])

  return displaySeconds
}
