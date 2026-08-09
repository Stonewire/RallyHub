import type { ReactNode } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { useAuth } from '@/contexts/auth-context'
import { canAccessRallyHub, facilitatorAllowedPath, isClientRole, isFacilitatorOnlyRole, eventManagerAllowedAdminPath, FACILITATOR_HOME } from '@/lib/auth-routes'
import { orgPath } from '@/lib/org-path'
import { isPublicLivePath } from '@/lib/public-routes'
import { isPlatformHost } from '@/lib/tenant'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, profileLoading, role } = useAuth()
  const location = useLocation()
  // Only set when this guard renders under the new /:clientSlug/admin mount
  // (Task 7); undefined under the existing unscoped /admin mount.
  const { clientSlug } = useParams<{ clientSlug?: string }>()

  // The path-based guards below (eventManagerAllowedAdminPath, etc.) were
  // written for the unscoped /admin/... shape and must not be rewritten --
  // strip the slug here instead, so a single set of rules covers both
  // mounts. Redirect targets are re-prefixed via orgPath() on the way out.
  const relativePath =
    clientSlug && location.pathname.startsWith(`/${clientSlug}/`)
      ? location.pathname.slice(clientSlug.length + 1)
      : location.pathname

  if (isPublicLivePath(location.pathname)) {
    return <>{children}</>
  }

  if (loading || (user && profileLoading)) {
    return <AuthLoadingScreen label="Loading profile" />
  }

  if (!user) {
    return (
      <Navigate
        to={{ pathname: '/login', search: location.search }}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  if (isFacilitatorOnlyRole(role) && !facilitatorAllowedPath(relativePath)) {
    return <Navigate to={orgPath(clientSlug, FACILITATOR_HOME)} replace />
  }

  if (
    role === 'event_manager' &&
    relativePath.startsWith('/admin') &&
    !eventManagerAllowedAdminPath(relativePath)
  ) {
    return <Navigate to={orgPath(clientSlug, '/admin/events')} replace />
  }

  if (
    isPlatformHost() &&
    relativePath.startsWith('/admin') &&
    role !== null &&
    !canAccessRallyHub(role) &&
    !isClientRole(role) &&
    !isFacilitatorOnlyRole(role)
  ) {
    return (
      <Navigate
        to={{ pathname: '/login', search: location.search }}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  if (relativePath.startsWith('/rallyhub')) {
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}
