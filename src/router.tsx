import { Navigate, createBrowserRouter } from 'react-router-dom'

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
import { PublicLiveOutlet } from '@/components/routing/PublicLiveOutlet'
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

export const router = createBrowserRouter([
  // Public live panels — no auth, listed first for explicit precedence
  {
    path: '/facilitator/:eventId',
    element: (
      <PublicLiveOutlet>
        <FacilitatorEventPage />
      </PublicLiveOutlet>
    ),
  },
  {
    path: '/display/:eventId',
    element: (
      <PublicLiveOutlet>
        <DisplayEventPage />
      </PublicLiveOutlet>
    ),
  },
  {
    path: '/join/:eventId',
    element: (
      <PublicLiveOutlet>
        <JoinEventPage />
      </PublicLiveOutlet>
    ),
  },
  {
    path: '/tablet',
    element: (
      <PublicLiveOutlet>
        <TabletPage />
      </PublicLiveOutlet>
    ),
  },
  { path: '/', element: <RootPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/admin',
    element: <HostAdminLayout />,
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
