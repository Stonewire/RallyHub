import { useEffect, useState, type ReactNode } from 'react'

type DisplayShellProps = {
  logo: string | null
  title: string
  /** Pinned to the top-right corner, e.g. the countdown. */
  headerCorner?: ReactNode
  children: ReactNode
}

/**
 * The width the display is laid out at, whatever screen it ends up on.
 *
 * Everything inside is written for a 1280 wide screen and then scaled, so a
 * 1080p TV renders it at 1.5x and a 4K one at 3x. Without this the layout was
 * capped: the title clamped at 48px, the content column at 1152px and the
 * leaderboard at a fixed 768x204 with 20px team names, identical on a laptop
 * and on a 4K screen across a room. A rule of thumb for reading at distance is
 * text at about a thirtieth of the screen height; 20px on a 1080p screen is
 * under half that.
 */
const DESIGN_WIDTH = 1280
/** Never shrink below the design size, and stop growing past 4K. */
const MAX_SCALE = 3

function useDisplayScale(): number {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth
      if (!width) return
      setScale(Math.min(MAX_SCALE, Math.max(1, width / DESIGN_WIDTH)))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return scale
}

/** Centered display chrome: logo and one-line title, timer in the corner. */
export function DisplayShell({ logo, title, headerCorner, children }: DisplayShellProps) {
  const scale = useDisplayScale()

  return (
    // The scaled layer is sized in reverse (a 3x scale gets a third of the
    // room) so that after scaling it lands exactly on the viewport. Percentages
    // rather than viewport units, so the same shell works inside the
    // facilitator's preview iframe.
    <div className="h-screen overflow-hidden">
      <div
        className="origin-top-left"
        style={{
          width: `${100 / scale}%`,
          height: `${100 / scale}%`,
          transform: `scale(${scale})`,
        }}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <header className="relative shrink-0 px-10 pt-6 pb-4">
            {headerCorner ? (
              <div className="absolute top-5 right-10 z-10">{headerCorner}</div>
            ) : null}
            <div className="mx-auto flex w-full flex-col items-center justify-center text-center">
              {logo ? (
                <img
                  src={logo}
                  alt=""
                  className="mb-3 max-h-16 max-w-[min(100%,240px)] object-contain drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)]"
                />
              ) : null}
              {/* One line, always: the size shrinks with the viewport and with a
                  long name rather than wrapping. The inset keeps it clear of the
                  corner slot, which a long name otherwise runs under. */}
              <h1
                className={`font-sans w-full truncate text-[clamp(1.35rem,3.1vw,3rem)] leading-tight font-extrabold tracking-tight drop-shadow-md ${
                  headerCorner ? 'px-4 md:px-40' : ''
                }`}
              >
                {title}
              </h1>
            </div>
          </header>
          <main className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-8 pb-10">
            <div className="flex h-full w-full max-w-6xl items-center justify-center">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
