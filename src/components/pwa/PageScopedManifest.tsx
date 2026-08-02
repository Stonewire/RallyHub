import { useEffect } from 'react'

const DEFAULT_MANIFEST = '/manifest.webmanifest'
const PAGE_SCOPED_MANIFEST = '/manifest-here.webmanifest'

/**
 * Makes an install from this page open this page.
 *
 * The default manifest starts at `/`, which is right for an organiser: the root
 * already routes by role, so the icon lands an admin on the admin panel and a
 * facilitator on their event list. It is wrong for a tablet kiosk or a join
 * link, where the whole point of the icon is the one URL it was created from.
 *
 * A manifest with no `start_url` defaults to the page that links it, and with
 * no `id` it gets its own app identity, so two different tablets can hold two
 * different icons. Mount this on those routes only.
 */
export function PageScopedManifest() {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (!link) return

    link.setAttribute('href', PAGE_SCOPED_MANIFEST)
    return () => {
      link.setAttribute('href', DEFAULT_MANIFEST)
    }
  }, [])

  return null
}
