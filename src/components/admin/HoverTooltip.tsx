import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type HoverTooltipProps = {
  /** Text shown in the floating panel. Nothing renders when this is empty. */
  label: string
  children: ReactNode
  className?: string
  /** Delay before showing, in ms. Long enough not to fire while passing over. */
  delayMs?: number
}

/**
 * Small floating label on hover.
 *
 * Exists because the native `title` attribute cannot be styled and its delay is
 * browser-controlled and slow enough that people miss it. Rendered in a portal
 * so a card's `overflow-hidden` cannot clip it, and positioned from the
 * trigger's own rect rather than tracking the pointer, so it does not jitter.
 */
export function HoverTooltip({
  label,
  children,
  className,
  delayMs = 400,
}: HoverTooltipProps) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const timer = useRef<number | null>(null)
  const anchor = useRef<HTMLSpanElement>(null)

  function show() {
    if (!label.trim()) return
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const rect = anchor.current?.getBoundingClientRect()
      if (!rect) return
      setPoint({ x: rect.left + rect.width / 2, y: rect.top })
    }, delayMs)
  }

  function hide() {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    setPoint(null)
  }

  return (
    <span
      ref={anchor}
      className={className}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {point
        ? createPortal(
            <span
              role="tooltip"
              className="bg-nm-slate-900 pointer-events-none fixed z-[100] max-w-64 -translate-x-1/2 -translate-y-full rounded-md px-2 py-1 text-[11px] leading-snug text-white shadow-lg"
              style={{ left: point.x, top: point.y - 6 }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  )
}
