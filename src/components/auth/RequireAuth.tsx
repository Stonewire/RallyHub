import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { useAuth } from '@/contexts/auth-context'
import { canAccessRallyHub, isClientRole } from '@/lib/auth-routes'
import { isPlatformHost } from '@/lib/tenant'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, profileLoading, role } = useAuth()
  const location = useLocation()

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

  if (
    isPlatformHost() &&
    location.pathname.startsWith('/admin') &&
    !canAccessRallyHub(role) &&
    !isClientRole(role)
  ) {
    return <Navigate to="/login" replace />
  }

  if (location.pathname.startsWith('/rallyhub')) {
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}
