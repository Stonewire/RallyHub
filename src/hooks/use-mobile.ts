import * as React from "react"

// 1280 rather than 768: on tablets the docked sidebar wastes a strip of a
// small screen (Rumen, 9 Aug) — every iPad, both orientations, gets the
// hamburger + sheet nav. Real laptops (>=1280) keep the docked sidebar.
const MOBILE_BREAKPOINT = 1280

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
