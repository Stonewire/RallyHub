import { Camera } from 'lucide-react'
import type { CSSProperties } from 'react'

type Photo = {
  /** Path stem in /public/marketing, e.g. "/marketing/room-panorama" (widths appended). */
  base: string
  /** Available widths, ascending; the largest is the fallback src. */
  widths: number[]
  alt: string
  sizes?: string
}

type ImageSlotProps = {
  /** What the final photograph or screenshot will be — shown while the slot is empty. */
  label: string
  /** Ogilvy caption rendered under the frame; real selling copy, kept when the image lands. */
  caption?: string
  aspect?: string
  className?: string
  /** When present, the real photo renders instead of the placeholder frame. */
  photo?: Photo
}

/** A framed page image: the real photo once supplied, a labelled placeholder until then. */
export function ImageSlot({ label, caption, aspect = '4 / 3', className, photo }: ImageSlotProps) {
  const srcSet = (ext: 'webp' | 'jpg') =>
    photo!.widths.map((w) => `${photo!.base}-${w}.${ext} ${w}w`).join(', ')

  return (
    <figure className={className} style={{ margin: 0 }}>
      {photo ? (
        <picture>
          <source type="image/webp" srcSet={srcSet('webp')} sizes={photo.sizes ?? '100vw'} />
          <img
            className="mk-photo"
            src={`${photo.base}-${photo.widths[photo.widths.length - 1]}.jpg`}
            srcSet={srcSet('jpg')}
            sizes={photo.sizes ?? '100vw'}
            alt={photo.alt}
            loading="lazy"
            decoding="async"
            style={{ aspectRatio: aspect } as CSSProperties}
          />
        </picture>
      ) : (
        <div
          className="mk-slot"
          style={{ aspectRatio: aspect } as CSSProperties}
          role="img"
          aria-label={`Image placeholder: ${label}`}
        >
          <div className="mk-slot-inner">
            <Camera aria-hidden />
            <span className="mk-slot-label">{label}</span>
          </div>
        </div>
      )}
      {caption ? <figcaption className="mk-caption">{caption}</figcaption> : null}
    </figure>
  )
}
