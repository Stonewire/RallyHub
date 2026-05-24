import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export type TenantPublicOrg = {
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

export type TenantContext =
  | { kind: 'platform'; subdomain?: undefined }
  | { kind: 'tenant'; subdomain: string }

const PLATFORM_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  import.meta.env.VITE_PLATFORM_HOST ?? 'rallyhubapp.vercel.app',
])

export function platformHost(): string {
  return import.meta.env.VITE_PLATFORM_HOST ?? 'rallyhubapp.vercel.app'
}

export function parseTenantFromHost(hostname: string): TenantContext {
  const host = hostname.split(':')[0]?.toLowerCase() ?? ''

  if (typeof window !== 'undefined') {
    const override = new URLSearchParams(window.location.search).get('tenant')
    if (override?.trim()) {
      return { kind: 'tenant', subdomain: override.trim().toLowerCase() }
    }
  }

  if (PLATFORM_HOSTS.has(host)) {
    return { kind: 'platform' }
  }

  // {slug}.localhost for dev
  if (host.endsWith('.localhost')) {
    const sub = host.replace(/\.localhost$/, '')
    if (sub) return { kind: 'tenant', subdomain: sub }
  }

  // {slug}.rallyhubapp.vercel.app
  const platformSuffix = `.${platformHost()}`
  if (host.endsWith(platformSuffix)) {
    const sub = host.slice(0, -platformSuffix.length)
    if (sub && !sub.includes('.')) {
      return { kind: 'tenant', subdomain: sub }
    }
  }

  return { kind: 'platform' }
}

export function getTenantContext(): TenantContext {
  if (typeof window === 'undefined') return { kind: 'platform' }
  return parseTenantFromHost(window.location.hostname)
}

export function isPlatformHost(): boolean {
  return getTenantContext().kind === 'platform'
}

export function getOrganizationOrigin(org: {
  subdomain: string
  custom_domain?: string | null
}): string {
  if (typeof window === 'undefined') {
    const host = org.custom_domain ?? `${org.subdomain}.${platformHost()}`
    return `https://${host}`
  }

  const { protocol } = window.location
  if (org.custom_domain) {
    return `${protocol}//${org.custom_domain}`
  }

  const host = platformHost()
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `${protocol}//${org.subdomain}.localhost:${window.location.port || '5173'}`
  }

  return `${protocol}//${org.subdomain}.${host}`
}

export function getPlatformOrigin(): string {
  if (typeof window === 'undefined') {
    return `https://${platformHost()}`
  }
  const { protocol, hostname, port } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}${port ? `:${port}` : ''}`
  }
  return `${protocol}//${platformHost()}`
}

async function fetchTenantByHost(host: string): Promise<TenantPublicOrg | null> {
  const { data, error } = await supabase.rpc('resolve_tenant_by_host', {
    p_host: host,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return (row as TenantPublicOrg | undefined) ?? null
}

async function fetchTenantBySubdomain(subdomain: string): Promise<TenantPublicOrg | null> {
  const { data, error } = await supabase
    .from('organization_tenant_public')
    .select('*')
    .eq('subdomain', subdomain)
    .maybeSingle()
  if (error) throw error
  return data as TenantPublicOrg | null
}

export function useTenantOrganization() {
  const ctx = getTenantContext()
  const host =
    typeof window !== 'undefined' ? window.location.hostname : platformHost()

  return useQuery({
    queryKey: ['tenant-org', ctx.kind, ctx.kind === 'tenant' ? ctx.subdomain : host],
    enabled: ctx.kind === 'tenant',
    queryFn: async () => {
      if (ctx.kind !== 'tenant') return null
      const byHost = await fetchTenantByHost(host)
      if (byHost) return byHost
      return fetchTenantBySubdomain(ctx.subdomain)
    },
    staleTime: 60_000,
  })
}

export async function verifyTabletPassword(
  orgId: string,
  password: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('verify_tablet_password', {
    p_org_id: orgId,
    p_password: password,
  })
  if (error) throw error
  return Boolean(data)
}
