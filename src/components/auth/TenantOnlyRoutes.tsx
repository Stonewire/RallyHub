import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { isPublicLivePath } from '@/lib/public-routes'
import { isPlatformHost } from '@/lib/tenant'

export function TenantOnlyRoutes({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()

  if (isPublicLivePath(pathname)) {
    return <>{children}</>
  }

  if (isPlatformHost()) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
