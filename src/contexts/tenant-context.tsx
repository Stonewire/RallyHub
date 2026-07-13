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

// eslint-disable-next-line react-refresh/only-export-components -- companion hook for TenantProvider
export function useTenant() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTenant must be used within TenantProvider')
  return v
}

/**
 * Like useTenant, but returns null instead of throwing when there is no
 * TenantProvider above (e.g. the public /facilitator route, which is not wrapped
 * in TenantScope). For components that can render with or without a tenant.
 */
// eslint-disable-next-line react-refresh/only-export-components -- companion hook for TenantProvider
export function useOptionalTenant() {
  return useContext(Ctx)
}
