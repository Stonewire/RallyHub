import { Navigate, createBrowserRouter } from 'react-router-dom'

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
import { DisplayEventPage } from '@/pages/live/DisplayEventPage'
import { FacilitatorLandingPage } from '@/pages/live/FacilitatorLandingPage'
import { JoinEventPage } from '@/pages/live/JoinEventPage'
import { TabletPage } from '@/pages/live/TabletPage'
import { ContactPage } from '@/pages/marketing/ContactPage'
import { MarketingLandingPage } from '@/pages/marketing/MarketingLandingPage'
import { CookiePolicyPage } from '@/pages/legal/CookiePolicyPage'
import { ImprintPage } from '@/pages/legal/ImprintPage'
import { PrivacyPolicyPage } from '@/pages/legal/PrivacyPolicyPage'
import { TermsOfServicePage } from '@/pages/legal/TermsOfServicePage'
import { PlayTokenPage } from '@/pages/placeholders'
import { RallyHubClientDetailPage } from '@/pages/rallyhub/ClientDetailPage'
import { RallyHubClientsPage } from '@/pages/rallyhub/ClientsPage'
import { RallyHubPaymentsPage } from '@/pages/rallyhub/PaymentsPage'
import { RallyHubPromoCodesPage } from '@/pages/rallyhub/PromoCodesPage'
import { resolvePostLoginPath, isFacilitatorOnlyRole } from '@/lib/auth-routes'
import { isPlatformHost } from '@/lib/tenant'

function RootPage() {
  const { user, role, loading, profileLoading } = useAuth()

  if (!isPlatformHost()) {
    return <Navigate to="/admin" replace />
  }

  if (loading) {
    return <AuthLoadingScreen label="Loading" />
  }

  if (user && profileLoading) {
    return <AuthLoadingScreen label="Loading profile" />
  }

  if (user && !profileLoading) {
    const target = isFacilitatorOnlyRole(role)
      ? '/facilitator'
      : resolvePostLoginPath(undefined, role)
    return <Navigate to={target} replace />
  }

  return <MarketingLandingPage />
}

function NotFoundPage() {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-foreground text-2xl font-bold">Page not found</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        This URL does not match any RallyHub page.
      </p>
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
  { path: '/tablet/:orgSlug/:tabletCode', element: <TabletPage />, errorElement: <RouteErrorBoundary /> },
  { path: '/tablet', element: <TabletPage />, errorElement: <RouteErrorBoundary /> },

  { path: '/', element: <RootPage /> },
  { path: '/contact', element: <ContactPage /> },
  { path: '/privacy', element: <PrivacyPolicyPage /> },
  { path: '/terms', element: <TermsOfServicePage /> },
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
        <HostAdminLayout />
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
