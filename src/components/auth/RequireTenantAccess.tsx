import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { useAuth } from '@/contexts/auth-context'
import { useTenant } from '@/contexts/tenant-context'
import { canAccessRallyHub } from '@/lib/auth-routes'
import { getPlatformOrigin } from '@/lib/tenant'

export function RequireTenantAccess({ children }: { children: ReactNode }) {
  const { user, role, loading, profileLoading, profile } = useAuth()
  const { tenantOrg, tenantLoading, tenantError } = useTenant()

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
    return <Navigate to="/login" replace />
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
