import { Navigate } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { useAuth } from '@/contexts/auth-context'
import {
  canAccessOrgSettings,
  canAccessRallyHub,
  canManageOrgUsers,
  isFacilitatorOnlyRole,
} from '@/lib/auth-routes'
import { isPlatformHost } from '@/lib/tenant'
import { AdminEventsPage } from '@/pages/admin/EventsPage'
import { FacilitatorEventsPage } from '@/pages/admin/FacilitatorEventsPage'
import { FacilitatorSettingsPage } from '@/pages/admin/FacilitatorSettingsPage'
import { AdminEventEditPage } from '@/pages/admin/events/EditEventPage'
import { AdminEventsNewPage } from '@/pages/admin/events/NewEventPage'
import { AdminGameEditPage } from '@/pages/admin/games/EditGamePage'
import { AdminGamesNewPage } from '@/pages/admin/games/NewGamePage'
import { AdminGamesPage } from '@/pages/admin/GamesPage'
import { ClientDashboardPage } from '@/pages/admin/ClientDashboardPage'
import { AdminSettingsPage } from '@/pages/admin/SettingsPage'
import { AdminSupportPage } from '@/pages/admin/SupportPage'
import { AdminTeamPage } from '@/pages/admin/TeamPage'
import { RallyHubOverviewPage } from '@/pages/rallyhub/DashboardPage'
import { RallyHubSupportPage } from '@/pages/rallyhub/SupportPage'
import type { ReactNode } from 'react'

function useIsSuperAdminOnPlatform() {
  const { role, profileLoading } = useAuth()
  if (profileLoading) return null
  return canAccessRallyHub(role) && isPlatformHost()
}

export function AdminHomePage() {
  const { role, profileLoading } = useAuth()
  const mode = useIsSuperAdminOnPlatform()
  if (profileLoading || mode === null) return <AuthLoadingScreen label="Loading profile" />
  // Facilitators have no dashboard — their home is the events list.
  if (isFacilitatorOnlyRole(role)) return <Navigate to="/admin/events" replace />
  return mode ? <RallyHubOverviewPage /> : <ClientDashboardPage />
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
  const { role, profileLoading } = useAuth()
  if (profileLoading) return <AuthLoadingScreen label="Loading profile" />
  if (isFacilitatorOnlyRole(role)) return <FacilitatorEventsPage />
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
  const { role, profileLoading } = useAuth()
  const mode = useIsSuperAdminOnPlatform()
  if (profileLoading || mode === null) return <AuthLoadingScreen label="Loading profile" />
  // event_manager gets no org-wide Settings access (canAccessOrgSettings), but
  // still needs somewhere to edit their own name/username/email/password —
  // the same personal-only page facilitators use.
  if (isFacilitatorOnlyRole(role) || role === 'event_manager') {
    return <FacilitatorSettingsPage />
  }
  if (!canAccessOrgSettings(role)) {
    return <Navigate to="/admin/events" replace />
  }
  // Platform super admins get Settings too (My Account, and Team for the
  // owner); the page itself coerces the org tab away since they have no org.
  return <AdminSettingsPage />
}

export function ClientTeamRoute() {
  const { role, profileLoading } = useAuth()
  if (profileLoading) return <AuthLoadingScreen label="Loading profile" />
  if (!canManageOrgUsers(role)) {
    return <Navigate to="/admin/events" replace />
  }
  return (
    <ClientAdminOnly>
      <AdminTeamPage />
    </ClientAdminOnly>
  )
}

export { SuperAdminOnly, ClientAdminOnly }
