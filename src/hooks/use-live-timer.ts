import { useEffect, useRef, useState } from 'react'

/**
 * Local countdown synced to Supabase each tick.
 * Uses functional updates so the interval is not reset on every realtime reload.
 */
export function useLiveTimer(
  serverSeconds: number,
  serverRunning: boolean,
  onTick: (next: number, stillRunning: boolean) => void | Promise<void>,
) {
  const [displaySeconds, setDisplaySeconds] = useState(serverSeconds)
  const onTickRef = useRef(onTick)
  onTickRef.current = onTick

  useEffect(() => {
    setDisplaySeconds(serverSeconds)
  }, [serverSeconds])

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
