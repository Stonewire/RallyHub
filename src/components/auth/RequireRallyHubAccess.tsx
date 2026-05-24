import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { useAuth } from '@/contexts/auth-context'
import { canAccessRallyHub } from '@/lib/auth-routes'
import { isPlatformHost } from '@/lib/tenant'

export function RequireRallyHubAccess({ children }: { children: ReactNode }) {
  const { role, loading, profileLoading } = useAuth()

  if (loading || profileLoading) {
    return <AuthLoadingScreen />
  }

  if (!isPlatformHost()) {
    return <Navigate to="/admin" replace />
  }

  if (!canAccessRallyHub(role)) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
