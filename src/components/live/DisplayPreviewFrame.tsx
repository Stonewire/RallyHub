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
    <div className="flex items-center gap-2 p-2">
      <div
        ref={containerRef}
        className="relative min-w-0 flex-1 overflow-hidden rounded-md bg-black"
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
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0 gap-1.5 px-2 text-xs"
        onClick={() => {
          void copyToClipboard(displayUrl)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        Copy Link
      </Button>
    </div>
  )
}
