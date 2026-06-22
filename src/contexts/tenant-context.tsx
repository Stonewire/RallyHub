import { createContext, useContext, type ReactNode } from 'react'

import { ClientBrandingStyle } from '@/components/branding/ClientBrandingStyle'
import { getTenantContext, useTenantOrganization, type TenantContext } from '@/lib/tenant'

type TenantContextValue = {
  ctx: TenantContext
  tenantOrg: ReturnType<typeof useTenantOrganization>['data']
  tenantLoading: boolean
  tenantError: Error | null
}

const Ctx = createContext<TenantContextValue | null>(null)

export function TenantProvider({ children }: { children: ReactNode }) {
  const ctx = getTenantContext()
  const { data, isLoading, error } = useTenantOrganization()

  return (
    <Ctx.Provider
      value={{
        ctx,
        tenantOrg: data ?? null,
        tenantLoading: ctx.kind === 'tenant' && isLoading,
        tenantError: error as Error | null,
      }}
    >
      <ClientBrandingStyle org={data ?? null} />
      {children}
    </Ctx.Provider>
  )
}

export function useTenant() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTenant must be used within TenantProvider')
  return v
}
