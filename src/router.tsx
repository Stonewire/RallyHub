import { Navigate, createBrowserRouter } from 'react-router-dom'

import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireRallyHubAccess } from '@/components/auth/RequireRallyHubAccess'
import { AdminLayout } from '@/layouts/AdminLayout'
import { RallyHubLayout } from '@/layouts/RallyHubLayout'
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

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/admin',
    element: (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
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
    ],
  },
  {
    path: '/rallyhub',
    element: (
      <RequireAuth>
        <RequireRallyHubAccess>
          <RallyHubLayout />
        </RequireRallyHubAccess>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <RallyHubOverviewPage /> },
      { path: 'clients', element: <RallyHubClientsPage /> },
      { path: 'clients/:clientId', element: <RallyHubClientDetailPage /> },
      { path: 'games', element: <RallyHubGamesPage /> },
      { path: 'support', element: <RallyHubSupportPage /> },
    ],
  },
  { path: '/facilitator/:eventId', element: <FacilitatorEventPage /> },
  { path: '/display/:eventId', element: <DisplayEventPage /> },
  { path: '/join/:eventId', element: <JoinEventPage /> },
  { path: '/play/:token', element: <PlayTokenPage /> },
  { path: '/tablet', element: <TabletPage /> },
])
