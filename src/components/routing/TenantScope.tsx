import type { ReactNode } from 'react'

import { TenantProvider } from '@/contexts/tenant-context'

/** Tenant resolution only for admin/login — not public live panels. */
export function TenantScope({ children }: { children: ReactNode }) {
  return <TenantProvider>{children}</TenantProvider>
}
