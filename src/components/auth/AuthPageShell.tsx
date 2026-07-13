import type { ReactNode } from 'react'

import { RallyLogo } from '@/components/brand/RallyLogo'
import { LegalFooterLinks } from '@/components/legal/LegalFooterLinks'
import { useOptionalTenant } from '@/contexts/tenant-context'
import { isTenantHost } from '@/lib/tenant'

export function AuthPageShell({ children }: { children: ReactNode }) {
  const tenant = useOptionalTenant()
  const tenantOrg = tenant?.tenantOrg ?? null
  const tenantLoading = tenant?.tenantLoading ?? false

  return (
    <div className="neo-minimal-scope neo-minimal-inset flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 flex w-full max-w-sm flex-col items-center gap-3 text-center">
        <RallyLogo className="mx-auto max-h-16 w-auto sm:max-h-20" />
        {isTenantHost() && tenantOrg ? (
          <p className="text-muted-foreground text-sm font-medium">{tenantOrg.name}</p>
        ) : null}
        {isTenantHost() && tenantLoading ? (
          <p className="text-muted-foreground text-xs">Loading…</p>
        ) : null}
      </div>
      {children}
      <LegalFooterLinks inline className="mt-8 max-w-sm justify-center" />
    </div>
  )
}
