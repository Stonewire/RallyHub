import { Camera } from 'lucide-react'
import type { CSSProperties } from 'react'

type ImageSlotProps = {
  /** What the final photograph or screenshot will be — shown inside the placeholder. */
  label: string
  /** Ogilvy caption rendered under the frame; real selling copy, kept when the image lands. */
  caption?: string
  aspect?: string
  className?: string
}

/** Dashed placeholder frame for the planned shoot; swap for <img> once assets exist. */
export function ImageSlot({ label, caption, aspect = '4 / 3', className }: ImageSlotProps) {
  return (
    <figure className={className} style={{ margin: 0 }}>
      <div className="mk-slot" style={{ aspectRatio: aspect } as CSSProperties} role="img" aria-label={`Image placeholder: ${label}`}>
        <div className="mk-slot-inner">
          <Camera aria-hidden />
          <span className="mk-slot-label">{label}</span>
        </div>
      </div>
      {caption ? <figcaption className="mk-caption">{caption}</figcaption> : null}
    </figure>
  )
}
