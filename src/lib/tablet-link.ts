import { getPlatformOrigin } from '@/lib/tenant'

export function slugifyOrgName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function validateTabletCode(code: string): string | null {
  const c = code.trim()
  if (c.length < 1 || c.length > 10) return 'Tablet code must be 1–10 characters (letters or numbers).'
  if (!/^[a-zA-Z0-9]+$/.test(c)) return 'Use only letters and numbers.'
  return null
}

/** Internal canonical kiosk path (resolves the org + tablet code). */
export function getTabletPathParts(org: { name: string; tablet_slug: string }) {
  const orgSlug = slugifyOrgName(org.name) || 'org'
  return { orgSlug, code: org.tablet_slug }
}

/** Shareable tablet link: app.rallyhub.games/{client-slug}/tablet. The client
 *  slug (org subdomain) is the only editable part; changing it regenerates this. */
export function getTabletLink(org: { subdomain: string }) {
  return `${getPlatformOrigin()}/${org.subdomain}/tablet`
}
