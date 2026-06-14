import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type OrganizationTenantPublic =
  Database['public']['Views']['organization_tenant_public']['Row']

function firstRow<T>(data: T | T[] | null): T | null {
  if (data == null) return null
  return Array.isArray(data) ? (data[0] ?? null) : data
}

/** Single-org branding lookup (live panels, export). Falls back to null on failure. */
export async function fetchOrganizationTenantPublic(
  orgId: string,
): Promise<OrganizationTenantPublic | null> {
  const { data, error } = await supabase.rpc('get_organization_tenant_public', {
    p_org_id: orgId,
  })
  if (error) return null
  return firstRow(data as OrganizationTenantPublic | OrganizationTenantPublic[] | null)
}

export async function fetchOrganizationTenantBySubdomain(
  subdomain: string,
): Promise<OrganizationTenantPublic | null> {
  const { data, error } = await supabase.rpc('get_organization_tenant_by_subdomain', {
    p_subdomain: subdomain,
  })
  if (error) throw error
  return firstRow(data as OrganizationTenantPublic | OrganizationTenantPublic[] | null)
}

export async function fetchOrganizationsByTabletSlug(
  tabletSlug: string,
): Promise<OrganizationTenantPublic[]> {
  const { data, error } = await supabase.rpc('get_organizations_by_tablet_slug', {
    p_tablet_slug: tabletSlug,
  })
  if (error) throw error
  return (data ?? []) as OrganizationTenantPublic[]
}
