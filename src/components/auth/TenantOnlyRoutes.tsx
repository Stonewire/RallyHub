import type { ReactNode } from 'react'

/** @deprecated Legacy wrapper — pass-through only; do not redirect platform hosts. */
export function TenantOnlyRoutes({ children }: { children: ReactNode }) {
  return <>{children}</>
}
