import type { AppRole } from '@/types/database'

export function defaultPathForRole(role: AppRole | null): string {
  if (role === 'super_admin') return '/rallyhub'
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

  if (!canAccessRallyHub(role) && from.startsWith('/rallyhub')) {
    return '/admin'
  }

  if (from.startsWith('/')) return from
  return fallback
}
