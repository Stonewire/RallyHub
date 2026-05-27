import { useEffect, useRef, useState } from 'react'

/**
 * Local countdown synced to Supabase on tick (throttled by caller).
 * Uses a wall-clock deadline so the interval keeps ticking smoothly
 * even when serverSeconds updates from realtime.
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
  const deadlineRef = useRef<number | null>(null)
  const displayRef = useRef(serverSeconds)
  const wasRunningRef = useRef(false)

  useEffect(() => {
    displayRef.current = displaySeconds
  }, [displaySeconds])

  useEffect(() => {
    if (!serverRunning) {
      deadlineRef.current = null
      wasRunningRef.current = false
      setDisplaySeconds(serverSeconds)
      displayRef.current = serverSeconds
      return
    }

    const justStarted = !wasRunningRef.current
    wasRunningRef.current = true

    const drift =
      deadlineRef.current == null
        ? syncThreshold + 1
        : Math.abs(serverSeconds - displayRef.current)

    if (justStarted || deadlineRef.current == null || drift > syncThreshold) {
      deadlineRef.current = Date.now() + serverSeconds * 1000
      setDisplaySeconds(serverSeconds)
      displayRef.current = serverSeconds
    }
  }, [serverSeconds, serverRunning, syncThreshold])

  useEffect(() => {
    if (!serverRunning) return

    const tick = () => {
      const deadline = deadlineRef.current
      if (deadline == null) return

      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setDisplaySeconds(next)
      displayRef.current = next

      if (next <= 0) {
        deadlineRef.current = null
        void onTickRef.current(0, false)
        return
      }
      void onTickRef.current(next, true)
    }

    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [serverRunning])

  return displaySeconds
}
