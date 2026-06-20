import { useQuery } from '@tanstack/react-query'

import { isPublicLivePath, RESERVED_TENANT_SUBDOMAINS } from '@/lib/public-routes'
import { fetchOrganizationTenantBySubdomain } from '@/lib/organization-tenant'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

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
  hide_platform_branding: boolean
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

/** Shared client host for multi-domain setups (optional; not used for redirects on Hobby). */
export function tenantHost(): string | null {
  const host = import.meta.env.VITE_TENANT_HOST?.trim()
  return host || null
}

/** True when separate tenant host redirect is enabled (future: custom domain + wildcard). */
export function hasDedicatedTenantHost(): boolean {
  return Boolean(tenantHost())
}

export function isLocalDev(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

export function parseTenantFromHost(hostname: string): TenantContext {
  const host = hostname.split(':')[0]?.toLowerCase() ?? ''

  if (typeof window !== 'undefined' && isPublicLivePath(window.location.pathname)) {
    return { kind: 'platform' }
  }

  if (PLATFORM_HOSTS.has(host)) {
    return { kind: 'platform' }
  }

  if (typeof window !== 'undefined') {
    const override = new URLSearchParams(window.location.search).get('tenant')
    if (override?.trim()) {
      return { kind: 'tenant', subdomain: override.trim().toLowerCase() }
    }
  }

  const sharedTenantHost = tenantHost()?.split(':')[0]?.toLowerCase()
  if (sharedTenantHost && host === sharedTenantHost) {
    return { kind: 'tenant', subdomain: 'client' }
  }

  if (host.endsWith('.localhost')) {
    const sub = host.replace(/\.localhost$/, '')
    if (sub) return { kind: 'tenant', subdomain: sub }
  }

  const platformSuffix = `.${platformHost()}`
  if (host.endsWith(platformSuffix)) {
    const sub = host.slice(0, -platformSuffix.length)
    if (sub && !sub.includes('.') && !RESERVED_TENANT_SUBDOMAINS.has(sub)) {
      return { kind: 'tenant', subdomain: sub }
    }
    if (sub && RESERVED_TENANT_SUBDOMAINS.has(sub)) {
      return { kind: 'platform' }
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

export function isTenantHost(): boolean {
  return getTenantContext().kind === 'tenant'
}

/** Client app URL for a given org subdomain (shared tenant host or per-org subdomain). */
export function getClientAppUrl(orgSubdomain: string, path = '/admin'): string {
  const needsTenantQuery = orgSubdomain && orgSubdomain !== 'client'

  if (typeof window === 'undefined') {
    const shared = tenantHost()
    if (shared) {
      return needsTenantQuery
        ? `https://${shared}${path}?tenant=${encodeURIComponent(orgSubdomain)}`
        : `https://${shared}${path}`
    }
    return `https://${orgSubdomain}.${platformHost()}${path}`
  }

  const { protocol } = window.location

  if (isLocalDev()) {
    const origin = `${protocol}//${window.location.host}`
    return needsTenantQuery
      ? `${origin}${path}?tenant=${encodeURIComponent(orgSubdomain)}`
      : `${origin}${path}`
  }

  // Single-domain production (e.g. Vercel Hobby): stay on platform host
  if (isPlatformHost()) {
    return `${protocol}//${window.location.host}${path}`
  }

  const shared = tenantHost()
  if (shared) {
    const base = `${protocol}//${shared}`
    return needsTenantQuery
      ? `${base}${path}?tenant=${encodeURIComponent(orgSubdomain)}`
      : `${base}${path}`
  }

  return `${protocol}//${orgSubdomain}.${platformHost()}${path}`
}

export function getOrganizationOrigin(org: {
  subdomain: string
  custom_domain?: string | null
}): string {
  if (typeof window === 'undefined') {
    const shared = tenantHost()
    if (shared) return `https://${shared}?tenant=${org.subdomain}`
    const host = org.custom_domain ?? `${org.subdomain}.${platformHost()}`
    return `https://${host}`
  }

  const { protocol } = window.location
  if (org.custom_domain) {
    return `${protocol}//${org.custom_domain}`
  }

  if (isLocalDev()) {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tenant') === org.subdomain) {
      return `${protocol}//${window.location.host}`
    }
    return `${protocol}//${window.location.host}?tenant=${org.subdomain}`
  }

  if (isPlatformHost()) {
    return `${protocol}//${window.location.host}`
  }

  const shared = tenantHost()
  if (shared) {
    if (org.subdomain !== 'client') {
      return `${protocol}//${shared}?tenant=${org.subdomain}`
    }
    return `${protocol}//${shared}`
  }

  return `${protocol}//${org.subdomain}.${platformHost()}`
}

export function getPlatformOrigin(): string {
  if (typeof window === 'undefined') {
    return `https://${platformHost()}`
  }
  const { protocol, hostname, port } = window.location
  if (isLocalDev()) {
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
  return fetchOrganizationTenantBySubdomain(subdomain)
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
      if (isLocalDev() && ctx.subdomain) {
        const bySub = await fetchTenantBySubdomain(ctx.subdomain)
        if (bySub) return bySub
      }
      const byHost = await fetchTenantByHost(host)
      if (byHost) return byHost
      return fetchTenantBySubdomain(ctx.subdomain)
    },
    staleTime: 60_000,
  })
}

/** Returns a session token on success, null on incorrect password or lockout. */
export async function verifyTabletPassword(
  orgId: string,
  password: string,
): Promise<string | null> {
  const args: Database['public']['Functions']['verify_tablet_password']['Args'] = {
    p_org_id: orgId,
    p_password: password,
  }
  const { data, error } = await supabase.rpc('verify_tablet_password', args)
  if (error) throw error
  return data ?? null
}

export async function validateTabletSession(
  orgId: string,
  token: string,
): Promise<boolean> {
  const args: Database['public']['Functions']['validate_tablet_session']['Args'] = {
    p_org_id: orgId,
    p_token: token,
  }
  const { data, error } = await supabase.rpc('validate_tablet_session', args)
  if (error) return false
  return Boolean(data)
}
