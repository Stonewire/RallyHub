import type { AppRole } from '@/types/database'

import { isPlatformHost } from '@/lib/tenant'

export function defaultPathForRole(role: AppRole | null): string {
  if (isPlatformHost()) {
    if (role === 'super_admin') return '/admin'
    return '/login'
  }
  return '/admin'
}

export function canAccessRallyHub(role: AppRole | null): boolean {
  return role === 'super_admin'
}

export function resolvePostLoginPath(
  from: string | undefined,
  role: AppRole | null,
): string {
  const fallback = defaultPathForRole(role)

  if (!from || from === '/login') return fallback

  if (isPlatformHost()) {
    if (!canAccessRallyHub(role) && from.startsWith('/admin')) {
      return '/login'
    }
    if (from.startsWith('/rallyhub')) {
      return from.replace(/^\/rallyhub/, '/admin')
    }
  } else {
    if (canAccessRallyHub(role) && from.startsWith('/admin')) {
      return fallback
    }
    if (from.startsWith('/rallyhub')) {
      return '/admin'
    }
  }

  if (!canAccessRallyHub(role) && from.startsWith('/rallyhub')) {
    return '/admin'
  }

  if (from.startsWith('/')) return from
  return fallback
}
