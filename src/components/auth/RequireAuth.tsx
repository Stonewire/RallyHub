import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { useAuth } from '@/contexts/auth-context'
import { canAccessRallyHub, facilitatorAllowedPath, isClientRole, isFacilitatorOnlyRole, eventManagerAllowedAdminPath } from '@/lib/auth-routes'
import { isPublicLivePath } from '@/lib/public-routes'
import { isPlatformHost } from '@/lib/tenant'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, profileLoading, role } = useAuth()
  const location = useLocation()

  if (isPublicLivePath(location.pathname)) {
    return <>{children}</>
  }

  if (loading || (user && profileLoading)) {
    return <AuthLoadingScreen label="Loading profile" />
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  if (isFacilitatorOnlyRole(role) && !facilitatorAllowedPath(location.pathname)) {
    return <Navigate to="/facilitator" replace />
  }

  if (
    role === 'event_manager' &&
    location.pathname.startsWith('/admin') &&
    !eventManagerAllowedAdminPath(location.pathname)
  ) {
    return <Navigate to="/admin/events" replace />
  }

  if (
    isPlatformHost() &&
    location.pathname.startsWith('/admin') &&
    role !== null &&
    !canAccessRallyHub(role) &&
    !isClientRole(role)
  ) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  if (location.pathname.startsWith('/rallyhub')) {
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}
