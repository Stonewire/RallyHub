import { useEffect } from 'react'

import { usePlatformBrand } from '@/hooks/use-platform-brand'

/**
 * Sets the browser tab title for a surface, e.g. "RallyHub: Facilitator".
 * Pass the surface label and an optional detail (usually the event name) so
 * multiple open tabs are distinguishable. Restores the base title on unmount.
 *
 * The name in front is the brand this viewer should see, so a white-labelled
 * client's tabs carry their own name instead of ours.
 */
export function useDocumentTitle(surface: string, detail?: string | null) {
  const brand = usePlatformBrand()
  useEffect(() => {
    const name = detail?.trim()
    document.title = name ? `${brand}: ${surface} · ${name}` : `${brand}: ${surface}`
    return () => {
      document.title = brand
    }
  }, [brand, surface, detail])
}
