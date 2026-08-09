import type { CSSProperties } from 'react'

type DeviceMockProps = {
  /** Path stem in /public/marketing (widths appended). */
  base: string
  widths: number[]
  alt: string
  sizes?: string
  /** Screens the browser should fetch eagerly so hover swaps are instant. */
  preload?: string[]
  className?: string
}

/**
 * iPad mini shell around a real app screenshot. The bezel is drawn in CSS so
 * the screenshot stays the only asset and swaps cleanly when the screen changes.
 */
export function DeviceMock({ base, widths, alt, sizes, preload, className }: DeviceMockProps) {
  const srcSet = (ext: 'webp' | 'jpg') =>
    widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(', ')

  return (
    <div className={className ? `mk-ipad ${className}` : 'mk-ipad'}>
      <div className="mk-ipad-screen">
        <picture>
          <source type="image/webp" srcSet={srcSet('webp')} sizes={sizes ?? '100vw'} />
          <img
            src={`${base}-${widths[widths.length - 1]}.jpg`}
            srcSet={srcSet('jpg')}
            sizes={sizes ?? '100vw'}
            alt={alt}
            loading="lazy"
            decoding="async"
          />
        </picture>
      </div>
      <span className="mk-ipad-cam" aria-hidden />
      {/* Warm the other screens so hovering the list does not flash. */}
      {preload?.length ? (
        <div className="mk-preload" aria-hidden>
          {preload.map((p) => (
            <img key={p} src={`${p}-${widths[0]}.webp`} alt="" loading="lazy" decoding="async" />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export type { CSSProperties }
