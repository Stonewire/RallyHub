/** Subdomain for the RallyHub platform game library organization (not a client tenant). */
export const PLATFORM_LIBRARY_SUBDOMAIN = 'rallyhub-library'

export function platformOrgIdFromEnv(): string | undefined {
  const id = import.meta.env.VITE_PLATFORM_ORG_ID?.trim()
  return id || undefined
}
