import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { useAuth } from '@/contexts/auth-context'

/** Forces users with a temp password to change it before using the app. */
export function MustChangePasswordGuard({ children }: { children: ReactNode }) {
  const { user, profile, profileLoading } = useAuth()
  const location = useLocation()

  if (!user || profileLoading) {
    return <>{children}</>
  }

  if (!profile?.must_change_password) {
    return <>{children}</>
  }

  if (location.pathname === '/login/change-password') {
    return <>{children}</>
  }

  return (
    <Navigate
      to="/login/change-password"
      replace
      state={{ from: `${location.pathname}${location.search}` }}
    />
  )
}

export function MustChangePasswordGate() {
  const { user, profileLoading } = useAuth()

  if (user && profileLoading) {
    return <AuthLoadingScreen label="Loading profile" />
  }

  return null
}
