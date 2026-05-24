import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { isPlatformHost } from '@/lib/tenant'

export function TenantOnlyRoutes({ children }: { children: ReactNode }) {
  if (isPlatformHost()) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
