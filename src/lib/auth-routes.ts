import type { AppRole } from '@/types/database'

import { isTenantHost } from '@/lib/tenant'

export type AssignableOrgUserRole = Extract<
  AppRole,
  'facilitator' | 'event_manager' | 'client_admin'
>

/** Landing page for a facilitator: the restricted admin events list. */
export const FACILITATOR_HOME = '/admin/events'

export function defaultPathForRole(role: AppRole | null): string {
  if (!role) return '/login'
  if (role === 'facilitator') return FACILITATOR_HOME
  return '/admin'
}

export function canAccessRallyHub(role: AppRole | null): boolean {
  return role === 'super_admin'
}

export function isClientRole(role: AppRole | null): boolean {
  return role === 'client_admin' || role === 'event_manager'
}

/** Full org settings: profile, billing, tablet, all user roles. */
export function canAccessOrgSettings(role: AppRole | null): boolean {
  return role === 'client_admin' || role === 'super_admin'
}

/** May open team / add-user flows (event_manager: facilitators only). */
export function canManageOrgUsers(role: AppRole | null): boolean {
  return (
    role === 'client_admin' ||
    role === 'super_admin' ||
    role === 'event_manager'
  )
}

export function assignableOrgUserRoles(
  actorRole: AppRole | null,
): AssignableOrgUserRole[] {
  if (actorRole === 'super_admin' || actorRole === 'client_admin') {
    return ['facilitator', 'event_manager', 'client_admin']
  }
  if (actorRole === 'event_manager') {
    return ['facilitator']
  }
  return []
}

export function canAssignOrgUserRole(
  actorRole: AppRole | null,
  targetRole: AssignableOrgUserRole,
): boolean {
  return assignableOrgUserRoles(actorRole).includes(targetRole)
}

/** Admin paths an event_manager may visit (direct URL guard). */
export function eventManagerAllowedAdminPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/'
  if (path === '/admin') return true
  if (path.startsWith('/admin/events')) return true
  if (path.startsWith('/admin/games')) return true
  if (path.startsWith('/admin/support')) return true
  if (path.startsWith('/admin/team')) return true
  if (path.startsWith('/login')) return true
  return false
}

/** Dedicated facilitator account — no admin panel access. */
export function isFacilitatorOnlyRole(role: AppRole | null): boolean {
  return role === 'facilitator'
}

/** May open facilitator event windows (link + login). */
export function isAtLeastFacilitator(role: AppRole | null): boolean {
  return (
    role === 'facilitator' ||
    role === 'event_manager' ||
    role === 'client_admin' ||
    role === 'super_admin'
  )
}

/**
 * Admin paths a facilitator may visit: a read-only events list (to open event
 * links / QR codes) and their own profile settings. Nothing else in /admin.
 */
export function facilitatorAllowedAdminPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/'
  return path === '/admin' || path === '/admin/events' || path === '/admin/settings'
}

/** Paths a facilitator-only account may visit. */
export function facilitatorAllowedPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/'
  if (path === '/facilitator' || /^\/facilitator\/[^/]+$/.test(path)) return true
  if (path === '/login' || path.startsWith('/login/')) return true
  if (facilitatorAllowedAdminPath(path)) return true
  return false
}

export function resolvePostLoginPath(
  from: string | undefined,
  role: AppRole | null,
): string {
  const fallback = defaultPathForRole(role)

  if (!from || from === '/login') return fallback

  if (isFacilitatorOnlyRole(role) && !facilitatorAllowedPath(from)) {
    return FACILITATOR_HOME
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
