import { Link, Navigate, createBrowserRouter, useLocation } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
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
import { TenantScope } from '@/components/routing/TenantScope'
import { useAuth } from '@/contexts/auth-context'
import { LoginPage } from '@/pages/LoginPage'
import { ChangePasswordPage } from '@/pages/ChangePasswordPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { FacilitatorEventRoute } from '@/components/routing/FacilitatorEventRoute'
import { SlugEventRedirect, TabletSlugRedirect } from '@/components/routing/SlugRedirects'
import { DisplayEventPage } from '@/pages/live/DisplayEventPage'
import { FacilitatorLandingPage } from '@/pages/live/FacilitatorLandingPage'
import { JoinEventPage } from '@/pages/live/JoinEventPage'
import { InventoryPurchasePage } from '@/pages/live/InventoryPurchasePage'
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
import { resolvePostLoginPath } from '@/lib/auth-routes'
import { isPlatformHost } from '@/lib/tenant'

// eslint-disable-next-line react-refresh/only-export-components -- route-only component, this file also exports the router config
function RootPage() {
  const { user, role, loading, profileLoading } = useAuth()
  const { search } = useLocation()

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
  {
    path: '/inventory/item/:publicCode',
    element: <InventoryPurchasePage />,
    errorElement: <RouteErrorBoundary />,
  },
  { path: '/tablet/:orgSlug/:tabletCode', element: <TabletPage />, errorElement: <RouteErrorBoundary /> },
  { path: '/tablet', element: <TabletPage />, errorElement: <RouteErrorBoundary /> },

  // Pretty shareable slug links → resolve and forward to the real pages above.
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
  { path: '/:clientSlug/tablet', element: <TabletSlugRedirect />, errorElement: <RouteErrorBoundary /> },

  { path: '/', element: <RootPage /> },
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
    children: [
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
        element: <Navigate to="/admin/settings" replace />,
      },
      {
        path: 'settings/billing',
        element: <Navigate to="/admin/settings?tab=billing" replace />,
      },
      { path: 'support', element: <AdminSupportRoute /> },
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
    ],
  },
  { path: '/rallyhub', element: <Navigate to="/admin" replace /> },
  { path: '/rallyhub/*', element: <Navigate to="/admin" replace /> },
  { path: '/play/:token', element: <PlayTokenPage /> },
  { path: '*', element: <NotFoundPage /> },
    ],
  },
])
