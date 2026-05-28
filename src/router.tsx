import { Navigate, createBrowserRouter } from 'react-router-dom'

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
  SuperAdminOnly,
} from '@/components/routing/AdminRouteDispatchers'
import { HostAdminLayout } from '@/components/routing/HostAdminLayout'
import { TenantScope } from '@/components/routing/TenantScope'
import { LoginPage } from '@/pages/LoginPage'
import { DisplayEventPage } from '@/pages/live/DisplayEventPage'
import { FacilitatorEventPage } from '@/pages/live/FacilitatorEventPage'
import { JoinEventPage } from '@/pages/live/JoinEventPage'
import { TabletPage } from '@/pages/live/TabletPage'
import { PlatformHomePage } from '@/pages/PlatformHomePage'
import { PlayTokenPage } from '@/pages/placeholders'
import { RallyHubClientDetailPage } from '@/pages/rallyhub/ClientDetailPage'
import { RallyHubClientsPage } from '@/pages/rallyhub/ClientsPage'
import { isPlatformHost } from '@/lib/tenant'

function RootPage() {
  return isPlatformHost() ? (
    <PlatformHomePage />
  ) : (
    <Navigate to="/admin" replace />
  )
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
    path: '/facilitator/:eventId',
    element: <FacilitatorEventPage />,
    errorElement: <RouteErrorBoundary />,
  },
  { path: '/display/:eventId', element: <DisplayEventPage /> },
  { path: '/join/:eventId', element: <JoinEventPage /> },
  { path: '/tablet/:orgSlug/:tabletCode', element: <TabletPage /> },
  { path: '/tablet', element: <TabletPage /> },

  { path: '/', element: <RootPage /> },
  {
    path: '/login',
    element: (
      <TenantScope>
        <LoginPage />
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
        path: 'clients/:clientId',
        element: (
          <SuperAdminOnly>
            <RallyHubClientDetailPage />
          </SuperAdminOnly>
        ),
      },
    ],
  },
  { path: '/rallyhub', element: <Navigate to="/admin" replace /> },
  { path: '/rallyhub/*', element: <Navigate to="/admin" replace /> },
  { path: '/play/:token', element: <PlayTokenPage /> },
  { path: '*', element: <NotFoundPage /> },
])
