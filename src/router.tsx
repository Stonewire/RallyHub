import type { ReactNode } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'

import { TenantOnlyRoutes } from '@/components/auth/TenantOnlyRoutes'
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

function LiveRoute({ children }: { children: ReactNode }) {
  if (isPlatformHost()) {
    return <Navigate to="/" replace />
  }
  return <TenantOnlyRoutes>{children}</TenantOnlyRoutes>
}

export const router = createBrowserRouter([
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
  {
    path: '/facilitator/:eventId',
    element: (
      <LiveRoute>
        <FacilitatorEventPage />
      </LiveRoute>
    ),
  },
  {
    path: '/display/:eventId',
    element: (
      <LiveRoute>
        <DisplayEventPage />
      </LiveRoute>
    ),
  },
  {
    path: '/join/:eventId',
    element: (
      <LiveRoute>
        <JoinEventPage />
      </LiveRoute>
    ),
  },
  {
    path: '/tablet',
    element: (
      <LiveRoute>
        <TabletPage />
      </LiveRoute>
    ),
  },
  { path: '/play/:token', element: <PlayTokenPage /> },
])
