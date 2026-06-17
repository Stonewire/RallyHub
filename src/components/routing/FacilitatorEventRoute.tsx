import { Navigate, useLocation } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { useAuth } from '@/contexts/auth-context'
import { isAtLeastFacilitator } from '@/lib/auth-routes'
import { FacilitatorEventPage } from '@/pages/live/FacilitatorEventPage'

export function FacilitatorEventRoute() {
  const { user, role, loading, profileLoading } = useAuth()
  const location = useLocation()

  if (loading || (user && profileLoading)) {
    return <AuthLoadingScreen label="Loading profile" />
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  if (!isAtLeastFacilitator(role)) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: `${location.pathname}${location.search}`,
          message: 'Facilitator access is required to run events.',
        }}
      />
    )
  }

  return <FacilitatorEventPage />
}
