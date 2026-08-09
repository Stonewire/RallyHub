import type { RouteObject } from 'react-router-dom'
import { Link, Navigate, createBrowserRouter, useLocation } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireTenantAccess } from '@/components/auth/RequireTenantAccess'
import { RouteErrorBoundary } from '@/components/errors/RouteErrorBoundary'
import {
  AdminGamesRoute,
  AdminHomePage,
  AdminSupportRoute,
  ClientEventEditRoute,
  ClientEventsNewRoute,
  ClientEventsRoute,
  ClientGameDetailRoute,
  ClientGamesNewRoute,
  ClientSettingsRoute,
  ClientTeamRoute,
  SuperAdminOnly,
} from '@/components/routing/AdminRouteDispatchers'
import { HostAdminLayout } from '@/components/routing/HostAdminLayout'
import { AppRootLayout } from '@/components/routing/AppRootLayout'
import { PathTenantScope } from '@/components/routing/PathTenantScope'
import { TenantScope } from '@/components/routing/TenantScope'
import { AdminLayout } from '@/layouts/AdminLayout'
import { useAuth } from '@/contexts/auth-context'
import { useOptionalTenant } from '@/contexts/tenant-context'
import { LoginPage } from '@/pages/LoginPage'
import { ChangePasswordPage } from '@/pages/ChangePasswordPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { FacilitatorEventRoute } from '@/components/routing/FacilitatorEventRoute'
import { SlugEventRedirect, TabletSlugRedirect } from '@/components/routing/SlugRedirects'
import { DisplayEventPage } from '@/pages/live/DisplayEventPage'
import { FacilitatorLandingPage } from '@/pages/live/FacilitatorLandingPage'
import { JoinEventPage } from '@/pages/live/JoinEventPage'
import { TabletPage } from '@/pages/live/TabletPage'
import { ContactPage } from '@/pages/marketing/ContactPage'
import { MarketingLandingPage } from '@/pages/marketing/MarketingLandingPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { LegalAcceptanceGate } from '@/components/legal/LegalAcceptanceGate'
import { CookiePolicyPage } from '@/pages/legal/CookiePolicyPage'
import { DataProcessingAgreementPage } from '@/pages/legal/DataProcessingAgreementPage'
import { ImprintPage } from '@/pages/legal/ImprintPage'
import { PrivacyPolicyPage } from '@/pages/legal/PrivacyPolicyPage'
import { TermsOfServicePage } from '@/pages/legal/TermsOfServicePage'
import { PlayTokenPage } from '@/pages/placeholders'
import { RallyHubClientDetailPage } from '@/pages/rallyhub/ClientDetailPage'
import { RallyHubClientEventViewPage } from '@/pages/rallyhub/ClientEventViewPage'
import { RallyHubClientsPage } from '@/pages/rallyhub/ClientsPage'
import { RallyHubPaymentsPage } from '@/pages/rallyhub/PaymentsPage'
import { RallyHubPromoCodesPage } from '@/pages/rallyhub/PromoCodesPage'
import { resolvePostLoginPath, wrongDomainRedirectUrl } from '@/lib/auth-routes'
import { isDemoHost } from '@/lib/demo-sandbox'
import { getTenantContext, isPlatformHost, isTenantHost, platformHost } from '@/lib/tenant'

// eslint-disable-next-line react-refresh/only-export-components -- route-only component, this file also exports the router config
function RootPage() {
  const { user, role, loading, profileLoading } = useAuth()
  const { search } = useLocation()
  const tenant = useOptionalTenant()

  // Legacy subdomain host (e.g. sharphawk.app.rallyhub.games) — forward to
  // the new path-based URL instead of rendering here. Demo host is excluded:
  // it's a synthetic tenant context (isDemoHost short-circuits it inside
  // parseTenantFromHost) and stays fully host-based, out of scope per spec.
  if (isTenantHost() && !isDemoHost() && typeof window !== 'undefined') {
    const ctx = getTenantContext()
    if (ctx.kind === 'tenant') {
      // Hold the first render until the host's org has resolved. Without this
      // the redirect below can never fire: the tenant query is still in flight
      // on the first pass, so tenantOrg is null and we'd fall straight through
      // to the /admin Navigate and render at the old host anyway.
      if (tenant?.tenantLoading) {
        return <AuthLoadingScreen label="Loading" />
      }
      if (tenant?.tenantOrg?.subdomain) {
        window.location.replace(
          `https://${platformHost()}/${tenant.tenantOrg.subdomain}/admin${search}`,
        )
        return <AuthLoadingScreen label="Redirecting" />
      }
    }
  }

  if (!isPlatformHost()) {
    return <Navigate to={{ pathname: '/admin', search }} replace />
  }

  // admin.rallyhub.games is for super-admins — skip the marketing page.
  const adminHost = import.meta.env.VITE_ADMIN_HOST
  if (adminHost && typeof window !== 'undefined' && window.location.hostname === adminHost) {
    return <Navigate to="/admin" replace />
  }

  if (loading) {
    return <AuthLoadingScreen label="Loading" />
  }

  if (user && profileLoading) {
    return <AuthLoadingScreen label="Loading profile" />
  }

  if (user && !profileLoading) {
    const wrongDomain = wrongDomainRedirectUrl(role)
    if (wrongDomain && typeof window !== 'undefined') {
      window.location.replace(wrongDomain)
      return <AuthLoadingScreen label="Redirecting" />
    }
    return <Navigate to={resolvePostLoginPath(undefined, role)} replace />
  }

  // On app.rallyhub.games, unauthenticated visitors go straight to login.
  // rallyhub.games (apex/marketing) keeps showing the landing page.
  const platformH = import.meta.env.VITE_PLATFORM_HOST
  if (platformH && typeof window !== 'undefined' && window.location.hostname === platformH) {
    return <Navigate to="/login" replace />
  }

  return <MarketingLandingPage />
}

// eslint-disable-next-line react-refresh/only-export-components -- route-only component, this file also exports the router config
function NotFoundPage() {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <p className="text-primary text-xs font-bold tracking-[0.16em] uppercase">404</p>
      <h1 className="text-foreground mt-2 text-3xl font-bold">Page not found</h1>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        This URL does not match any RallyHub page.
      </p>
      <Link
        to="/"
        className="bg-primary text-primary-foreground mt-6 rounded-md px-4 py-2 text-sm font-semibold"
      >
        Back to RallyHub
      </Link>
    </div>
  )
}

/**
 * The client admin panel's pages, mounted twice: once host-scoped at /admin
 * (admin.rallyhub.games and the legacy tenant subdomains) and once path-scoped
 * at /:clientSlug/admin (app.rallyhub.games). Shared so the two mounts can't
 * drift apart.
 *
 * The two settings redirects use route-relative targets ('../settings'), which
 * resolve against the parent mount — /admin/settings under the first mount,
 * /:clientSlug/admin/settings under the second. Absolute targets would send
 * slug-scoped users out of their own panel.
 */
const adminRouteChildren: RouteObject[] = [
  { index: true, element: <AdminHomePage /> },
  { path: 'games', element: <AdminGamesRoute /> },
  { path: 'games/new', element: <ClientGamesNewRoute /> },
  { path: 'games/:gameId', element: <ClientGameDetailRoute /> },
  { path: 'events', element: <ClientEventsRoute /> },
  { path: 'events/new', element: <ClientEventsNewRoute /> },
  { path: 'events/:eventId', element: <ClientEventEditRoute /> },
  { path: 'settings', element: <ClientSettingsRoute /> },
  { path: 'team', element: <ClientTeamRoute /> },
  {
    path: 'settings/organization',
    element: <Navigate to="../settings" replace />,
  },
  {
    path: 'settings/billing',
    element: <Navigate to="../settings?tab=billing" replace />,
  },
  { path: 'support', element: <AdminSupportRoute /> },
]

/**
 * Super-admin-only pages. These live on the host-scoped /admin mount only —
 * super admins never operate inside a client's slug-scoped panel.
 */
const superAdminRouteChildren: RouteObject[] = [
  {
    path: 'clients',
    element: (
      <SuperAdminOnly>
        <RallyHubClientsPage />
      </SuperAdminOnly>
    ),
  },
  {
    path: 'clients/new',
    element: (
      <SuperAdminOnly>
        <RallyHubClientDetailPage />
      </SuperAdminOnly>
    ),
  },
  {
    path: 'clients/:clientId',
    element: (
      <SuperAdminOnly>
        <RallyHubClientDetailPage />
      </SuperAdminOnly>
    ),
  },
  {
    path: 'clients/:clientId/events/:eventId',
    element: (
      <SuperAdminOnly>
        <RallyHubClientEventViewPage />
      </SuperAdminOnly>
    ),
  },
  {
    path: 'payments',
    element: (
      <SuperAdminOnly>
        <RallyHubPaymentsPage />
      </SuperAdminOnly>
    ),
  },
  {
    path: 'promo-codes',
    element: (
      <SuperAdminOnly>
        <RallyHubPromoCodesPage />
      </SuperAdminOnly>
    ),
  },
]

/**
 * Public live routes are top-level siblings (no layout wrapper) so nothing
 * can redirect them before the router matches. Do not wrap these in LiveRoute
 * or TenantOnlyRoutes.
 */
export const router = createBrowserRouter([
  {
    element: <AppRootLayout />,
    children: [
  {
    path: '/facilitator',
    element: <FacilitatorLandingPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/facilitator/:eventId',
    element: <FacilitatorEventRoute />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/display/:eventId',
    element: <DisplayEventPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/join/:eventId',
    element: <JoinEventPage />,
    errorElement: <RouteErrorBoundary />,
  },
  { path: '/tablet/:orgSlug/:tabletCode', element: <TabletPage />, errorElement: <RouteErrorBoundary /> },
  { path: '/tablet', element: <TabletPage />, errorElement: <RouteErrorBoundary /> },

  // Pretty shareable slug links → resolve and forward to the real pages above.
  // Legacy 4-segment form (/{client}/events/{event}/{surface}) stays mounted
  // as an alias; the 3-segment form below is the primary shape.
  {
    path: '/:clientSlug/events/:eventSlug/facilitator',
    element: <SlugEventRedirect surface="facilitator" />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/:clientSlug/events/:eventSlug/display',
    element: <SlugEventRedirect surface="display" />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/:clientSlug/events/:eventSlug/teams',
    element: <SlugEventRedirect surface="join" />,
    errorElement: <RouteErrorBoundary />,
  },

  // Primary slug links: /{client}/{event}/{surface}. Kept after the static-
  // prefixed live routes above so a same-rank match (e.g. /tablet/x/display)
  // still resolves to the older, more specific route.
  {
    path: '/:clientSlug/:eventSlug/facilitator',
    element: <SlugEventRedirect surface="facilitator" />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/:clientSlug/:eventSlug/display',
    element: <SlugEventRedirect surface="display" />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/:clientSlug/:eventSlug/join',
    element: <SlugEventRedirect surface="join" />,
    errorElement: <RouteErrorBoundary />,
  },
  { path: '/:clientSlug/tablet', element: <TabletSlugRedirect />, errorElement: <RouteErrorBoundary /> },

  {
    // TenantScope so RootPage's useOptionalTenant() has a provider above it:
    // without one the legacy-subdomain redirect below never has an org to
    // redirect with. Host-based resolution is exactly right here — this is the
    // "someone visited an old subdomain host" case. Costs nothing on the
    // marketing apex: useTenantOrganization() is disabled for platform hosts.
    path: '/',
    element: (
      <TenantScope>
        <RootPage />
      </TenantScope>
    ),
  },
  { path: '/contact', element: <ContactPage /> },
  { path: '/privacy', element: <PrivacyPolicyPage /> },
  { path: '/terms', element: <TermsOfServicePage /> },
  { path: '/dpa', element: <DataProcessingAgreementPage /> },
  { path: '/cookies', element: <CookiePolicyPage /> },
  { path: '/imprint', element: <ImprintPage /> },
  {
    path: '/login',
    element: (
      <TenantScope>
        <LoginPage />
      </TenantScope>
    ),
  },
  {
    path: '/register',
    element: (
      <TenantScope>
        <RegisterPage />
      </TenantScope>
    ),
  },
  {
    path: '/login/forgot',
    element: (
      <TenantScope>
        <ForgotPasswordPage />
      </TenantScope>
    ),
  },
  {
    path: '/login/change-password',
    element: (
      <TenantScope>
        <ChangePasswordPage />
      </TenantScope>
    ),
  },
  {
    path: '/login/reset',
    element: (
      <TenantScope>
        <ResetPasswordPage />
      </TenantScope>
    ),
  },
  {
    path: '/admin',
    element: (
      <TenantScope>
        {/* Nobody reaches the admin panel without having accepted the current
            terms, privacy policy and DPA. Catches super-admin-created accounts,
            who never saw the registration form. */}
        <LegalAcceptanceGate>
          <HostAdminLayout />
        </LegalAcceptanceGate>
      </TenantScope>
    ),
    children: [...adminRouteChildren, ...superAdminRouteChildren],
  },
  {
    // Path-scoped client panel on app.rallyhub.games. Always the client shell,
    // so it mounts AdminLayout directly instead of HostAdminLayout (whose only
    // job is picking between the RallyHub and client shells by host).
    path: '/:clientSlug/admin',
    element: (
      <PathTenantScope>
        <LegalAcceptanceGate>
          <RequireAuth>
            <RequireTenantAccess>
              <AdminLayout />
            </RequireTenantAccess>
          </RequireAuth>
        </LegalAcceptanceGate>
      </PathTenantScope>
    ),
    children: adminRouteChildren,
  },
  { path: '/rallyhub', element: <Navigate to="/admin" replace /> },
  { path: '/rallyhub/*', element: <Navigate to="/admin" replace /> },
  { path: '/play/:token', element: <PlayTokenPage /> },
  { path: '*', element: <NotFoundPage /> },
    ],
  },
])
