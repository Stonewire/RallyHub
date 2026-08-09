import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

type RevealProps = React.HTMLAttributes<HTMLElement> & {
  children: ReactNode
  /** Stagger index; each step adds ~90ms delay. */
  delay?: number
  as?: ElementType
}

/**
 * Fades/rises content in when it scrolls into view. Falls back to visible
 * immediately when reduced motion is requested or IntersectionObserver is
 * unavailable, so nothing is ever hidden without the animation.
 */
/** True when we should skip the animation and show content immediately. */
function prefersInstant(): boolean {
  if (typeof window === 'undefined') return true
  if (!('IntersectionObserver' in window)) return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function Reveal({ children, delay = 0, as: Tag = 'div', className, style, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(prefersInstant)

  useEffect(() => {
    if (visible) return
    const el = ref.current
    if (!el) return

    // If it is already on (or above) the screen at mount, reveal right away.
    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          setVisible(true)
          obs.unobserve(entry.target)
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(el)
    // Safety net: never leave content hidden if the observer never fires
    // (fast scroll, background tab throttling, flaky environments).
    const fallback = window.setTimeout(() => setVisible(true), 1600)
    return () => {
      observer.disconnect()
      window.clearTimeout(fallback)
    }
  }, [visible])

  return (
    <Tag
      ref={ref}
      className={cn('mkt-reveal', visible && 'is-visible', className)}
      style={{
        ...style,
        ...(delay ? ({ '--mkt-delay': `${delay * 90}ms` } as React.CSSProperties) : null),
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/** Thin gold bar that tracks scroll progress. Hidden under reduced motion (CSS). */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const bar = ref.current
    if (!bar) return
    let frame = 0
    const update = () => {
      frame = 0
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      const percent = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0
      bar.style.width = `${Math.min(100, Math.max(0, percent))}%`
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return <div ref={ref} className="mkt-scroll-progress" aria-hidden />
}
