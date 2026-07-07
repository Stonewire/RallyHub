import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { copyToClipboard } from '@/lib/event-links'

const PREVIEW_W = 1920
const PREVIEW_H = 1080

type DisplayPreviewFrameProps = {
  displayUrl: string
}

export function DisplayPreviewFrame({ displayUrl }: DisplayPreviewFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.2)
  const [copied, setCopied] = useState(false)

  const src = displayUrl.includes('?')
    ? `${displayUrl}&embed=1`
    : `${displayUrl}?embed=1`

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const update = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w <= 0 || h <= 0) return
      setScale(Math.min(w / PREVIEW_W, h / PREVIEW_H))
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scaledW = PREVIEW_W * scale
  const scaledH = PREVIEW_H * scale

  return (
    // UI-3 (#18): the preview fills the card edge to edge; the copy control is
    // an overlay icon on the display itself, faint until hovered.
    <div
      ref={containerRef}
      className="group relative w-full overflow-hidden bg-black"
      style={{ aspectRatio: '16 / 9' }}
    >
      <div
        className="absolute top-1/2 left-1/2 overflow-hidden"
        style={{
          width: scaledW,
          height: scaledH,
          marginLeft: -scaledW / 2,
          marginTop: -scaledH / 2,
        }}
      >
        <iframe
          title="Display preview"
          src={src}
          className="pointer-events-none border-0"
          style={{
            width: PREVIEW_W,
            height: PREVIEW_H,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        title="Copy display link"
        className="absolute top-2 left-2 border-white/30 bg-black/40 text-white opacity-40 backdrop-blur-sm transition-opacity hover:bg-black/60 hover:text-white hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-80"
        onClick={() => {
          void copyToClipboard(displayUrl)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
      {copied ? (
        <span className="absolute top-2 left-11 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          Link copied
        </span>
      ) : null}
    </div>
  )
}
