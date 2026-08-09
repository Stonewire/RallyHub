type Screen = {
  id: string
  /** Path stem in /public/marketing (widths appended). */
  base: string
  alt: string
}

type DeviceMockProps = {
  screens: Screen[]
  activeId: string
  widths: number[]
  sizes?: string
  className?: string
}

/**
 * iPad mini shell around real app screenshots.
 *
 * Every screen is rendered once and stays mounted; switching only changes
 * opacity. Swapping the src (or remounting via key) makes the browser drop the
 * painted frame first, which reads as a flicker.
 */
export function DeviceMock({ screens, activeId, widths, sizes, className }: DeviceMockProps) {
  const srcSet = (base: string, ext: 'webp' | 'jpg') =>
    widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(', ')

  return (
    <div className={className ? `mk-ipad ${className}` : 'mk-ipad'}>
      <div className="mk-ipad-screen">
        {screens.map((screen) => {
          const isActive = screen.id === activeId
          return (
            <picture key={screen.id} className="mk-ipad-layer" data-active={isActive}>
              <source type="image/webp" srcSet={srcSet(screen.base, 'webp')} sizes={sizes ?? '100vw'} />
              <img
                src={`${screen.base}-${widths[widths.length - 1]}.jpg`}
                srcSet={srcSet(screen.base, 'jpg')}
                sizes={sizes ?? '100vw'}
                alt={isActive ? screen.alt : ''}
                aria-hidden={!isActive}
                loading="lazy"
                decoding="async"
              />
            </picture>
          )
        })}
      </div>
      <span className="mk-ipad-cam" aria-hidden />
    </div>
  )
}
