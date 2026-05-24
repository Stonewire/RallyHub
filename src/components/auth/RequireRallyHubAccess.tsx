import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { useAuth } from '@/contexts/auth-context'
import { canAccessRallyHub } from '@/lib/auth-routes'

/** Extra guard for /rallyhub tree (RequireAuth already redirects non–super-admins). */
export function RequireRallyHubAccess({ children }: { children: ReactNode }) {
  const { role, loading, profileLoading } = useAuth()

  if (loading || profileLoading) {
    return <AuthLoadingScreen />
  }

  if (!canAccessRallyHub(role)) {
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}
