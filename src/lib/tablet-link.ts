import { getOrganizationOrigin } from '@/lib/tenant'

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

export function getTabletPathParts(org: { name: string; tablet_slug: string }) {
  const orgSlug = slugifyOrgName(org.name) || 'org'
  return { orgSlug, code: org.tablet_slug }
}

export function getTabletLink(org: {
  name: string
  tablet_slug: string
  subdomain: string
  custom_domain?: string | null
}) {
  const base = getOrganizationOrigin(org)
  const { orgSlug, code } = getTabletPathParts(org)
  return `${base}/tablet/${encodeURIComponent(orgSlug)}/${encodeURIComponent(code)}`
}

export function getTabletLinkPrefix(org: {
  name: string
  subdomain: string
  custom_domain?: string | null
}) {
  const base = getOrganizationOrigin(org)
  const orgSlug = slugifyOrgName(org.name) || 'org'
  return `${base}/tablet/${orgSlug}/`
}
