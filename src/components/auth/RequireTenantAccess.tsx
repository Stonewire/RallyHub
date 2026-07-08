import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { useAuth } from '@/contexts/auth-context'
import { useTenant } from '@/contexts/tenant-context'
import { canAccessRallyHub, isFacilitatorOnlyRole } from '@/lib/auth-routes'
import { isPublicLivePath } from '@/lib/public-routes'
import { getPlatformOrigin } from '@/lib/tenant'

export function RequireTenantAccess({ children }: { children: ReactNode }) {
  const { user, role, loading, profileLoading, profile } = useAuth()
  const { tenantOrg, tenantLoading, tenantError } = useTenant()
  const { pathname, search } = useLocation()

  if (isPublicLivePath(pathname)) {
    return <>{children}</>
  }

  if (loading || profileLoading || tenantLoading) {
    return <AuthLoadingScreen />
  }

  if (tenantError || !tenantOrg) {
    return (
      <div className="flex min-h-svh items-center justify-center px-6 text-center">
        <p className="text-muted-foreground text-sm">
          {tenantError?.message ?? 'Organization not found for this URL.'}
        </p>
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate to="/login" replace state={{ from: `${pathname}${search}` }} />
    )
  }

  if (isFacilitatorOnlyRole(role)) {
    return <Navigate to="/facilitator" replace />
  }

  if (canAccessRallyHub(role)) {
    window.location.href = `${getPlatformOrigin()}/admin`
    return <AuthLoadingScreen label="Redirecting" />
  }

  if (profile?.organization_id && profile.organization_id !== tenantOrg.id) {
    return (
      <div className="flex min-h-svh items-center justify-center px-6 text-center">
        <p className="text-muted-foreground text-sm">
          Your account belongs to a different organization. Use your organization&apos;s login URL.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
