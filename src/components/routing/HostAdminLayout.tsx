import { Navigate, useLocation } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireRallyHubAccess } from '@/components/auth/RequireRallyHubAccess'
import { RequireTenantAccess } from '@/components/auth/RequireTenantAccess'
import { useAuth } from '@/contexts/auth-context'
import { useOrganization } from '@/hooks/use-organization-settings'
import { useOrganizationId } from '@/hooks/use-organization-id'
import { AdminLayout } from '@/layouts/AdminLayout'
import { RallyHubLayout } from '@/layouts/RallyHubLayout'
import { canAccessRallyHub, wrongDomainRedirectUrl } from '@/lib/auth-routes'
import { orgPath } from '@/lib/org-path'
import { supabase } from '@/lib/supabase'
import { isPlatformHost, isTenantHost } from '@/lib/tenant'

// Facilitators are allowed into the admin shell now, but only onto their
// restricted surface (events list + profile). RequireAuth + the route
// dispatchers enforce which paths/pages they actually reach.
export function HostAdminLayout() {
  const { user, role, loading, profileLoading } = useAuth()
  const { pathname, search } = useLocation()
  const organizationId = useOrganizationId()
  // Only needed for a signed-in client role on the platform host -- it's how
  // we find their org's slug to send them into /{slug}/admin below.
  const needsOrgSlug =
    Boolean(user) && !profileLoading && isPlatformHost() && !canAccessRallyHub(role)
  const { data: org, isLoading: orgLoading } = useOrganization(
    needsOrgSlug ? organizationId : null,
  )

  if (loading) {
    return <AuthLoadingScreen label="Loading" />
  }

  if (user && profileLoading) {
    return <AuthLoadingScreen label="Loading profile" />
  }

  // A session that authenticated before this migration, or on the wrong
  // origin some other way, must not get panel access just because a session
  // exists. /login and RootPage already reject this at sign-in; this repeats
  // the same check for a session that was already live when this renders.
  if (user) {
    const wrongDomain = wrongDomainRedirectUrl(role)
    if (wrongDomain && typeof window !== 'undefined') {
      // Sign out locally so the wrong-origin session doesn't linger and
      // re-trigger this bounce on every visit (matches RootPage).
      void supabase.auth.signOut({ scope: 'local' })
      window.location.replace(wrongDomain)
      return <AuthLoadingScreen label="Redirecting" />
    }
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
    // A client role still on the unscoped mount: once their org's slug is
    // known, send them into the real /{slug}/admin panel -- otherwise every
    // internal link stays unscoped forever (tenant context never resolves on
    // the platform host) and their branding never loads.
    if (needsOrgSlug && orgLoading) {
      return <AuthLoadingScreen label="Loading profile" />
    }
    if (org?.subdomain) {
      return <Navigate to={{ pathname: orgPath(org.subdomain, pathname), search }} replace />
    }
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
