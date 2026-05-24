import { Navigate, createBrowserRouter } from 'react-router-dom'

import { TenantOnlyRoutes } from '@/components/auth/TenantOnlyRoutes'
import { HostAdminLayout } from '@/components/routing/HostAdminLayout'
import { AdminDashboardPage } from '@/pages/admin/DashboardPage'
import { AdminEventsPage } from '@/pages/admin/EventsPage'
import { AdminEventEditPage } from '@/pages/admin/events/EditEventPage'
import { AdminEventsNewPage } from '@/pages/admin/events/NewEventPage'
import { AdminGamesNewPage } from '@/pages/admin/games/NewGamePage'
import { AdminGamesPage } from '@/pages/admin/GamesPage'
import { AdminSettingsPage } from '@/pages/admin/SettingsPage'
import { LoginPage } from '@/pages/LoginPage'
import { DisplayEventPage } from '@/pages/live/DisplayEventPage'
import { FacilitatorEventPage } from '@/pages/live/FacilitatorEventPage'
import { JoinEventPage } from '@/pages/live/JoinEventPage'
import { TabletPage } from '@/pages/live/TabletPage'
import { PlatformHomePage } from '@/pages/PlatformHomePage'
import {
  AdminGameDetailPage,
  AdminSupportPage,
  PlayTokenPage,
} from '@/pages/placeholders'
import { RallyHubClientDetailPage } from '@/pages/rallyhub/ClientDetailPage'
import { RallyHubClientsPage } from '@/pages/rallyhub/ClientsPage'
import { RallyHubOverviewPage } from '@/pages/rallyhub/DashboardPage'
import { RallyHubGamesPage } from '@/pages/rallyhub/GamesPage'
import { RallyHubSupportPage } from '@/pages/rallyhub/SupportPage'
import { getTenantContext } from '@/lib/tenant'

const rallyHubAdminChildren = [
  { index: true, element: <RallyHubOverviewPage /> },
  { path: 'clients', element: <RallyHubClientsPage /> },
  { path: 'clients/:clientId', element: <RallyHubClientDetailPage /> },
  { path: 'games', element: <RallyHubGamesPage /> },
  { path: 'support', element: <RallyHubSupportPage /> },
]

const clientAdminChildren = [
  { index: true, element: <AdminDashboardPage /> },
  { path: 'games', element: <AdminGamesPage /> },
  { path: 'games/new', element: <AdminGamesNewPage /> },
  { path: 'games/:gameId', element: <AdminGameDetailPage /> },
  { path: 'events', element: <AdminEventsPage /> },
  { path: 'events/new', element: <AdminEventsNewPage /> },
  { path: 'events/:eventId', element: <AdminEventEditPage /> },
  { path: 'settings', element: <AdminSettingsPage /> },
  {
    path: 'settings/organization',
    element: <Navigate to="/admin/settings" replace />,
  },
  {
    path: 'settings/billing',
    element: <Navigate to="/admin/settings?tab=billing" replace />,
  },
  { path: 'support', element: <AdminSupportPage /> },
]

const platformRoutes = [
  { path: '/', element: <PlatformHomePage /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/admin',
    element: <HostAdminLayout />,
    children: rallyHubAdminChildren,
  },
  { path: '/rallyhub', element: <Navigate to="/admin" replace /> },
  { path: '/rallyhub/*', element: <Navigate to="/admin" replace /> },
  { path: '/facilitator/:eventId', element: <Navigate to="/" replace /> },
  { path: '/display/:eventId', element: <Navigate to="/" replace /> },
  { path: '/join/:eventId', element: <Navigate to="/" replace /> },
  { path: '/tablet', element: <Navigate to="/" replace /> },
  { path: '/play/:token', element: <PlayTokenPage /> },
]

const tenantRoutes = [
  { path: '/', element: <Navigate to="/admin" replace /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/admin',
    element: <HostAdminLayout />,
    children: clientAdminChildren,
  },
  { path: '/rallyhub', element: <Navigate to="/admin" replace /> },
  { path: '/rallyhub/*', element: <Navigate to="/admin" replace /> },
  {
    path: '/facilitator/:eventId',
    element: (
      <TenantOnlyRoutes>
        <FacilitatorEventPage />
      </TenantOnlyRoutes>
    ),
  },
  {
    path: '/display/:eventId',
    element: (
      <TenantOnlyRoutes>
        <DisplayEventPage />
      </TenantOnlyRoutes>
    ),
  },
  {
    path: '/join/:eventId',
    element: (
      <TenantOnlyRoutes>
        <JoinEventPage />
      </TenantOnlyRoutes>
    ),
  },
  {
    path: '/tablet',
    element: (
      <TenantOnlyRoutes>
        <TabletPage />
      </TenantOnlyRoutes>
    ),
  },
  { path: '/play/:token', element: <PlayTokenPage /> },
]

function createAppRouter() {
  const ctx = getTenantContext()
  const routes = ctx.kind === 'platform' ? platformRoutes : tenantRoutes
  return createBrowserRouter(routes)
}

export const router = createAppRouter()
