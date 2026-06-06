/** Subdomain for the RallyHub platform game library organization (not a client tenant). */
export const PLATFORM_LIBRARY_SUBDOMAIN = 'rallyhub-library'

export function platformOrgIdFromEnv(): string | undefined {
  const id = import.meta.env.VITE_PLATFORM_ORG_ID?.trim()
  return id || undefined
}

/** True when an organization should appear in the super-admin clients list. */
export function isListedClientOrganization(
  org: { id: string; subdomain: string },
  excludedOrganizationIds: readonly string[] = [],
): boolean {
  if (org.subdomain === PLATFORM_LIBRARY_SUBDOMAIN) return false
  if (excludedOrganizationIds.includes(org.id)) return false
  return true
}
