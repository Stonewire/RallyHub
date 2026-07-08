import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  DEMO_OVERLAY_CYCLE_MS,
  DEMO_OVERLAY_VISIBLE_MS,
} from '@/lib/event-demo'

type DemoOverlayProps = {
  enabled: boolean
}

/** Full-screen DEMO watermark: visible 2s, hidden 18s, repeating. */
export function DemoOverlay({ enabled }: DemoOverlayProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the timer-driven blink cycle when demo mode turns off
      setVisible(false)
      return
    }

    let hideTimeout: ReturnType<typeof setTimeout> | undefined

    function show() {
      setVisible(true)
      hideTimeout = setTimeout(() => setVisible(false), DEMO_OVERLAY_VISIBLE_MS)
    }

    show()
    const interval = setInterval(show, DEMO_OVERLAY_CYCLE_MS)

    return () => {
      clearInterval(interval)
      if (hideTimeout) clearTimeout(hideTimeout)
    }
  }, [enabled])

  if (!enabled || !visible || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[10040] flex items-center justify-center bg-black/45"
      aria-hidden
    >
      <p className="font-sans select-none text-[min(16vw,8rem)] font-extrabold tracking-[0.2em] text-white/95">
        DEMO
      </p>
    </div>,
    document.body,
  )
}
