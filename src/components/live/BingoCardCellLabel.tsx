import { useLayoutEffect, useRef, useState } from 'react'

const MIN_SCALE = 0.5
const SCALE_STEP = 0.04

function bingoCellBaseFontPx(): number {
  if (typeof window === 'undefined') return 13
  // Read across a table on a tablet, so it starts larger and only shrinks for
  // the cells that genuinely need it.
  if (window.matchMedia('(min-width: 1024px)').matches) return 16
  return window.matchMedia('(min-width: 640px)').matches ? 15 : 13
}

function contentFits(container: HTMLElement, content: HTMLElement): boolean {
  return (
    content.scrollHeight <= container.clientHeight &&
    content.scrollWidth <= container.clientWidth
  )
}

/**
 * Bingo card cell label: wraps title and artist on multiple lines; shrinks font
 * only for this cell when a long word would overflow standard dimensions.
 */
export function BingoCardCellLabel({
  title,
  artist,
}: {
  title: string
  artist?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [basePx, setBasePx] = useState(11)

  useLayoutEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    const fit = () => {
      const base = bingoCellBaseFontPx()
      setBasePx(base)

      let chosen = MIN_SCALE
      let fits = false
      for (let s = 1; s >= MIN_SCALE; s -= SCALE_STEP) {
        content.style.overflowWrap = 'break-word'
        content.style.fontSize = `${base * s}px`
        if (contentFits(container, content)) {
          chosen = s
          fits = true
          break
        }
      }
      if (!fits) {
        content.style.overflowWrap = 'anywhere'
        content.style.fontSize = `${base * MIN_SCALE}px`
      }
      setScale(chosen)
    }

    fit()

    const ro = new ResizeObserver(() => fit())
    ro.observe(container)

    const mq = window.matchMedia('(min-width: 640px)')
    const onMq = () => fit()
    mq.addEventListener('change', onMq)

    return () => {
      ro.disconnect()
      mq.removeEventListener('change', onMq)
    }
  }, [title, artist])

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full min-h-0 items-center justify-center overflow-hidden"
    >
      <div
        ref={contentRef}
        className="xp-bingo-cell-label w-full max-w-full text-center leading-tight break-words"
        style={{ fontSize: `${basePx * scale}px` }}
      >
        <div className="font-black">{title}</div>
        {artist ? (
          <div className="font-semibold opacity-70 [font-size:0.85em]">{artist}</div>
        ) : null}
      </div>
    </div>
  )
}
