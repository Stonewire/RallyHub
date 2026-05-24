import { useEffect, useRef } from 'react'

/**
 * Count down every second while `running` is true.
 * Uses refs so the interval is not reset on each second tick from realtime reloads.
 */
export function useEventTimerTick(
  running: boolean,
  seconds: number,
  onTick: (next: number) => void | Promise<void>,
) {
  const secondsRef = useRef(seconds)
  const onTickRef = useRef(onTick)

  secondsRef.current = seconds
  onTickRef.current = onTick

  useEffect(() => {
    if (!running) return

    const id = window.setInterval(() => {
      const current = secondsRef.current
      if (current <= 0) return
      const next = current - 1
      void onTickRef.current(next)
    }, 1000)

    return () => window.clearInterval(id)
  }, [running])
}
