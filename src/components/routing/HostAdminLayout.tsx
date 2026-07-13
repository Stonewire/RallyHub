import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireRallyHubAccess } from '@/components/auth/RequireRallyHubAccess'
import { RequireTenantAccess } from '@/components/auth/RequireTenantAccess'
import { useAuth } from '@/contexts/auth-context'
import { AdminLayout } from '@/layouts/AdminLayout'
import { RallyHubLayout } from '@/layouts/RallyHubLayout'
import { canAccessRallyHub } from '@/lib/auth-routes'
import { isPlatformHost, isTenantHost } from '@/lib/tenant'

// Facilitators are allowed into the admin shell now, but only onto their
// restricted surface (events list + profile). RequireAuth + the route
// dispatchers enforce which paths/pages they actually reach.
export function HostAdminLayout() {
  const { role, profileLoading } = useAuth()

  if (profileLoading) {
    return <AuthLoadingScreen label="Loading profile" />
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
