import type { AppRole } from '@/types/database'

import { isPlatformHost, isTenantHost } from '@/lib/tenant'

export function defaultPathForRole(role: AppRole | null): string {
  if (!role) return '/login'
  return '/admin'
}

export function canAccessRallyHub(role: AppRole | null): boolean {
  return role === 'super_admin'
}

export function isClientRole(role: AppRole | null): boolean {
  return role === 'client_admin' || role === 'event_manager'
}

export function resolvePostLoginPath(
  from: string | undefined,
  role: AppRole | null,
): string {
  const fallback = defaultPathForRole(role)

  if (!from || from === '/login') return fallback

  if (from.startsWith('/rallyhub')) {
    return from.replace(/^\/rallyhub/, '/admin')
  }

  if (isTenantHost() && canAccessRallyHub(role) && from.startsWith('/admin')) {
    return '/admin'
  }

  if (from.startsWith('/')) return from
  return fallback
}

/**
 * When true, client users on the platform apex are sent to a separate tenant host.
 * Disabled while on Vercel Hobby (single domain). Re-enable when wildcard/custom domain is available.
 */
export function shouldRedirectClientOffPlatform(_role: AppRole | null): boolean {
  return false
}

export function usesRoleBasedPlatformAdmin(): boolean {
  return isPlatformHost()
}
