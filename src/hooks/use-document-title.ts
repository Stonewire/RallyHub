import { useEffect } from 'react'

const BASE = 'RallyHub'

/**
 * Sets the browser tab title for a surface, e.g. "RallyHub: Facilitator".
 * Pass the surface label and an optional detail (usually the event name) so
 * multiple open tabs are distinguishable. Restores the base title on unmount.
 */
export function useDocumentTitle(surface: string, detail?: string | null) {
  useEffect(() => {
    const name = detail?.trim()
    document.title = name ? `${BASE}: ${surface} · ${name}` : `${BASE}: ${surface}`
    return () => {
      document.title = BASE
    }
  }, [surface, detail])
}
