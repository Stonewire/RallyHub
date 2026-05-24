import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireRallyHubAccess } from '@/components/auth/RequireRallyHubAccess'
import { RequireTenantAccess } from '@/components/auth/RequireTenantAccess'
import { AdminLayout } from '@/layouts/AdminLayout'
import { RallyHubLayout } from '@/layouts/RallyHubLayout'
import { isPlatformHost } from '@/lib/tenant'

export function HostAdminLayout() {
  if (isPlatformHost()) {
    return (
      <RequireAuth>
        <RequireRallyHubAccess>
          <RallyHubLayout />
        </RequireRallyHubAccess>
      </RequireAuth>
    )
  }

  return (
    <RequireAuth>
      <RequireTenantAccess>
        <AdminLayout />
      </RequireTenantAccess>
    </RequireAuth>
  )
}
