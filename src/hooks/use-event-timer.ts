import { useEffect, useRef } from 'react'

/** Tick event or break timer down while running (facilitator host). */
export function useEventTimerTick(
  running: boolean,
  seconds: number,
  onTick: (next: number) => void,
) {
  const ref = useRef(onTick)
  ref.current = onTick

  useEffect(() => {
    if (!running || seconds <= 0) return
    const id = window.setInterval(() => {
      ref.current(Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [running, seconds])
}
