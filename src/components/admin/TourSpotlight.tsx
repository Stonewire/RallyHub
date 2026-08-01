import { IconArrowDown, IconArrowUp } from '@/components/icons'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

function useTargetRect(selector: string) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    let raf: number
    let scrolledIntoView = false
    const tick = () => {
      const el = document.querySelector(`[data-tour="${selector}"]`)
      if (el && !scrolledIntoView) {
        scrolledIntoView = true
        const r = el.getBoundingClientRect()
        if (r.top < 80 || r.bottom > window.innerHeight - 80) {
          // ponytail: instant jump — smooth scrolls get cancelled by the rAF re-render churn
          el.scrollIntoView({ block: 'center' })
        }
      }
      const next = el ? el.getBoundingClientRect() : null
      setRect((prev) => {
        if (!next) return prev === null ? prev : null
        if (
          prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width &&
          prev.height === next.height
        ) {
          return prev
        }
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [selector])

  return rect
}

type TourSpotlightProps = {
  targetSelector: string
  label: string
  waitingForClick: boolean
  onTargetClick: () => void
}

/** Non-blocking highlight ring + arrow callout pointing at a real, still-clickable UI element. */
export function TourSpotlight({
  targetSelector,
  label,
  waitingForClick,
  onTargetClick,
}: TourSpotlightProps) {
  const rect = useTargetRect(targetSelector)

  useEffect(() => {
    if (!waitingForClick) return
    function handleClick(e: MouseEvent) {
      const el = document.querySelector(`[data-tour="${targetSelector}"]`)
      if (el && e.target instanceof Node && el.contains(e.target)) {
        onTargetClick()
      }
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [targetSelector, waitingForClick, onTargetClick])

  if (!rect) return null

  const pad = 6
  const top = rect.top - pad
  const left = rect.left - pad
  const width = rect.width + pad * 2
  const height = rect.height + pad * 2

  const placeAbove = rect.bottom + 70 > window.innerHeight
  const calloutTop = placeAbove ? Math.max(top - 42, 8) : Math.min(top + height + 10, window.innerHeight - 44)
  const calloutLeft = Math.min(Math.max(left, 8), window.innerWidth - 240)

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <div
        className="absolute rounded-lg transition-all duration-150"
        style={{
          top,
          left,
          width,
          height,
          boxShadow: '0 0 0 9999px rgba(15,15,15,0.45), 0 0 0 2px var(--nm-yellow, #FFC107)',
        }}
      />
      <div
        className="absolute flex max-w-56 items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-lg"
        style={{ top: calloutTop, left: calloutLeft }}
      >
        {placeAbove ? <IconArrowDown className="size-3.5 shrink-0" /> : <IconArrowUp className="size-3.5 shrink-0" />}
        {label}
      </div>
    </div>,
    document.body,
  )
}
