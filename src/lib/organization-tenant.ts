import { slugifyOrgName } from '@/lib/tablet-link'
import { supabase } from '@/lib/supabase'

/** Public org branding row returned by 038 tenant RPCs. */
export type OrganizationTenantPublic = {
  id: string
  subdomain: string
  custom_domain: string | null
  name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  accent_color: string
  tablet_slug: string
}

function firstRow<T>(data: T | T[] | null): T | null {
  if (data == null) return null
  return Array.isArray(data) ? (data[0] ?? null) : data
}

function matchesOrgSlug(org: OrganizationTenantPublic, orgSlug: string): boolean {
  const normalized = orgSlug.toLowerCase()
  return (
    slugifyOrgName(org.name) === normalized ||
    org.subdomain.toLowerCase() === normalized
  )
}

/** Single-org branding lookup (live panels, export). Returns null on failure. */
export async function fetchOrganizationTenantPublic(
  orgId: string,
): Promise<OrganizationTenantPublic | null> {
  const { data, error } = await supabase.rpc('get_organization_tenant_public', {
    p_org_id: orgId,
  })
  if (error) return null
  return firstRow(data as OrganizationTenantPublic | OrganizationTenantPublic[] | null)
}

/** Subdomain lookup for tenant bootstrap / legacy tablet URLs. Returns null on failure. */
export async function fetchOrganizationTenantBySubdomain(
  subdomain: string,
): Promise<OrganizationTenantPublic | null> {
  const { data, error } = await supabase.rpc('get_organization_tenant_by_subdomain', {
    p_subdomain: subdomain,
  })
  if (error) return null
  return firstRow(data as OrganizationTenantPublic | OrganizationTenantPublic[] | null)
}

/** Tablet access-code lookup. Returns empty array on failure. */
export async function fetchOrganizationsByTabletSlug(
  tabletSlug: string,
): Promise<OrganizationTenantPublic[]> {
  const { data, error } = await supabase.rpc('get_organizations_by_tablet_slug', {
    p_tablet_slug: tabletSlug,
  })
  if (error) return []
  return (data ?? []) as OrganizationTenantPublic[]
}

/**
 * Resolve org for the tablet page via 038 RPCs only (no direct table/view SELECT).
 * Returns null when the link is invalid, stale, or the org does not exist.
 */
export async function resolveTabletOrganization(
  orgSlug: string | undefined,
  tabletCode: string | undefined,
  legacyOrgParam: string,
): Promise<OrganizationTenantPublic | null> {
  if (orgSlug && tabletCode) {
    const candidates = await fetchOrganizationsByTabletSlug(tabletCode)
    if (candidates.length === 0) return null
    return candidates.find((o) => matchesOrgSlug(o, orgSlug)) ?? null
  }

  if (!legacyOrgParam) return null

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      legacyOrgParam,
    )

  if (isUuid) {
    return fetchOrganizationTenantPublic(legacyOrgParam)
  }

  const bySubdomain = await fetchOrganizationTenantBySubdomain(legacyOrgParam)
  if (bySubdomain) return bySubdomain

  const byTablet = await fetchOrganizationsByTabletSlug(legacyOrgParam)
  if (byTablet.length === 1) return byTablet[0]
  if (byTablet.length > 1) {
    const normalized = legacyOrgParam.toLowerCase()
    return (
      byTablet.find((o) => matchesOrgSlug(o, normalized)) ??
      byTablet.find((o) => o.tablet_slug === legacyOrgParam) ??
      byTablet[0]
    )
  }

  return null
}
