import { Navigate } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireRallyHubAccess } from '@/components/auth/RequireRallyHubAccess'
import { RequireTenantAccess } from '@/components/auth/RequireTenantAccess'
import { useAuth } from '@/contexts/auth-context'
import { AdminLayout } from '@/layouts/AdminLayout'
import { RallyHubLayout } from '@/layouts/RallyHubLayout'
import { canAccessRallyHub, isFacilitatorOnlyRole } from '@/lib/auth-routes'
import { isPlatformHost, isTenantHost } from '@/lib/tenant'

export function HostAdminLayout() {
  const { role, profileLoading } = useAuth()

  if (profileLoading) {
    return <AuthLoadingScreen label="Loading profile" />
  }

  if (isFacilitatorOnlyRole(role)) {
    return <Navigate to="/facilitator" replace />
  }

  if (isPlatformHost() && canAccessRallyHub(role)) {
    return (
      <RequireAuth>
        <RequireRallyHubAccess>
          <RallyHubLayout />
        </RequireRallyHubAccess>
      </RequireAuth>
    )
  }

  if (isPlatformHost()) {
    return (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    )
  }

  if (isTenantHost()) {
    return (
      <RequireAuth>
        <RequireTenantAccess>
          <AdminLayout />
        </RequireTenantAccess>
      </RequireAuth>
    )
  }

  return (
    <RequireAuth>
      <AuthLoadingScreen label="Redirecting" />
    </RequireAuth>
  )
}
