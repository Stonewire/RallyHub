import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
      if (w <= 0) return
      setScale(w / PREVIEW_W)
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="flex items-stretch gap-1.5 p-2">
      <div
        ref={containerRef}
        className="aspect-video min-w-0 flex-1 overflow-hidden rounded-md bg-black"
        style={{ height: 'auto' }}
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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 shrink-0 self-center"
            onClick={() => {
              void copyToClipboard(displayUrl)
              setCopied(true)
              window.setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy display link</TooltipContent>
      </Tooltip>
    </div>
  )
}
