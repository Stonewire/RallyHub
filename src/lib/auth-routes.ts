import type { AppRole } from '@/types/database'

import { isPlatformHost, isTenantHost } from '@/lib/tenant'

export function defaultPathForRole(role: AppRole | null): string {
  if (!role) return '/login'
  if (role === 'facilitator') return '/facilitator'
  return '/admin'
}

export function canAccessRallyHub(role: AppRole | null): boolean {
  return role === 'super_admin'
}

export function isClientRole(role: AppRole | null): boolean {
  return role === 'client_admin' || role === 'event_manager'
}

/** Dedicated facilitator account — no admin panel access. */
export function isFacilitatorOnlyRole(role: AppRole | null): boolean {
  return role === 'facilitator'
}

/** May open facilitator event windows (link + login). */
export function isAtLeastFacilitator(role: AppRole | null): boolean {
  return (
    role === 'facilitator' ||
    role === 'client_admin' ||
    role === 'super_admin'
  )
}

/** Paths a facilitator-only account may visit. */
export function facilitatorAllowedPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/'
  if (path === '/facilitator' || /^\/facilitator\/[^/]+$/.test(path)) return true
  if (path === '/login' || path.startsWith('/login/')) return true
  return false
}

export function resolvePostLoginPath(
  from: string | undefined,
  role: AppRole | null,
): string {
  const fallback = defaultPathForRole(role)

  if (!from || from === '/login') return fallback

  if (isFacilitatorOnlyRole(role) && !facilitatorAllowedPath(from)) {
    return '/facilitator'
  }

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

export function profileDisplayName(profile: {
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  username?: string | null
} | null): string {
  if (!profile) return ''
  const fromParts = [profile.first_name, profile.last_name]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(' ')
  return fromParts || profile.full_name?.trim() || profile.username?.trim() || ''
}
