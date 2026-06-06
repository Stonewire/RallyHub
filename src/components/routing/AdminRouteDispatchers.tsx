import { Navigate } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { useAuth } from '@/contexts/auth-context'
import { canAccessRallyHub } from '@/lib/auth-routes'
import { isPlatformHost } from '@/lib/tenant'
import { AdminEventsPage } from '@/pages/admin/EventsPage'
import { AdminEventEditPage } from '@/pages/admin/events/EditEventPage'
import { AdminEventsNewPage } from '@/pages/admin/events/NewEventPage'
import { AdminGameEditPage } from '@/pages/admin/games/EditGamePage'
import { AdminGamesNewPage } from '@/pages/admin/games/NewGamePage'
import { AdminGamesPage } from '@/pages/admin/GamesPage'
import { AdminSettingsPage } from '@/pages/admin/SettingsPage'
import { AdminSupportPage } from '@/pages/admin/SupportPage'
import { RallyHubOverviewPage } from '@/pages/rallyhub/DashboardPage'
import { RallyHubSupportPage } from '@/pages/rallyhub/SupportPage'
import type { ReactNode } from 'react'

function useIsSuperAdminOnPlatform() {
  const { role, profileLoading } = useAuth()
  if (profileLoading) return null
  return canAccessRallyHub(role) && isPlatformHost()
}

export function AdminHomePage() {
  const mode = useIsSuperAdminOnPlatform()
  if (mode === null) return <AuthLoadingScreen label="Loading profile" />
  return mode ? <RallyHubOverviewPage /> : <Navigate to="/admin/events" replace />
}

export function AdminGamesRoute() {
  const mode = useIsSuperAdminOnPlatform()
  if (mode === null) return <AuthLoadingScreen label="Loading profile" />
  return <AdminGamesPage />
}

export function AdminSupportRoute() {
  const mode = useIsSuperAdminOnPlatform()
  if (mode === null) return <AuthLoadingScreen label="Loading profile" />
  return mode ? <RallyHubSupportPage /> : <AdminSupportPage />
}

function SuperAdminOnly({ children }: { children: ReactNode }) {
  const mode = useIsSuperAdminOnPlatform()
  if (mode === null) return <AuthLoadingScreen label="Loading profile" />
  if (!mode) return <Navigate to="/admin" replace />
  return <>{children}</>
}

function ClientAdminOnly({ children }: { children: ReactNode }) {
  const mode = useIsSuperAdminOnPlatform()
  if (mode === null) return <AuthLoadingScreen label="Loading profile" />
  if (mode) return <Navigate to="/admin" replace />
  return <>{children}</>
}

export function ClientGamesNewRoute() {
  return <AdminGamesNewPage />
}

export function ClientGameDetailRoute() {
  return <AdminGameEditPage />
}

export function ClientEventsRoute() {
  return (
    <ClientAdminOnly>
      <AdminEventsPage />
    </ClientAdminOnly>
  )
}

export function ClientEventsNewRoute() {
  return (
    <ClientAdminOnly>
      <AdminEventsNewPage />
    </ClientAdminOnly>
  )
}

export function ClientEventEditRoute() {
  return (
    <ClientAdminOnly>
      <AdminEventEditPage />
    </ClientAdminOnly>
  )
}

export function ClientSettingsRoute() {
  return (
    <ClientAdminOnly>
      <AdminSettingsPage />
    </ClientAdminOnly>
  )
}

export { SuperAdminOnly, ClientAdminOnly }
