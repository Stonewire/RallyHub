import type { ReactNode } from 'react'

import { RallyLogo } from '@/components/brand/RallyLogo'
import { LegalFooterLinks } from '@/components/legal/LegalFooterLinks'
import { useOptionalTenant } from '@/contexts/tenant-context'
import { useTheme } from '@/contexts/theme-context'
import { isTenantHost } from '@/lib/tenant'

export function AuthPageShell({ children }: { children: ReactNode }) {
  const tenant = useOptionalTenant()
  const tenantOrg = tenant?.tenantOrg ?? null
  const tenantLoading = tenant?.tenantLoading ?? false
  const { resolvedTheme } = useTheme()

  // R2.9 white label: a white-labelled client's people must not meet our mark
  // on the way in. Their own logo takes its place, or their name when they have
  // none. Light artwork belongs on the dark theme, dark artwork on the light.
  // Only resolvable when the URL carries the client (a tenant host); the bare
  // platform host has nobody signed in and no slug, so it stays ours.
  const whiteLabel = tenantOrg?.hide_platform_branding ?? false
  // While the tenant is still resolving we do not yet know whether this client
  // is white-labelled, and painting our mark for the length of that round trip
  // would show it to exactly the people it is meant to be hidden from. Hold the
  // slot empty instead: it is a moment either way, and the wrong logo cannot be
  // taken back once seen.
  const brandUnknown = isTenantHost() && tenantLoading && !tenantOrg
  const themedLogo = resolvedTheme === 'dark' ? tenantOrg?.logo_light_url : tenantOrg?.logo_dark_url
  const clientLogo = whiteLabel ? (themedLogo ?? tenantOrg?.logo_url ?? null) : null

  return (
    <div className="neo-minimal-scope neo-minimal-inset flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 flex w-full max-w-sm flex-col items-center gap-3 text-center">
        {brandUnknown ? (
          <div className="h-16 sm:h-20" aria-hidden />
        ) : whiteLabel ? (
          clientLogo ? (
            <img
              src={clientLogo}
              alt={tenantOrg?.name ?? ''}
              className="mx-auto max-h-16 w-auto object-contain sm:max-h-20"
            />
          ) : (
            <p className="text-foreground text-xl font-semibold">{tenantOrg?.name}</p>
          )
        ) : (
          <RallyLogo className="mx-auto max-h-16 w-auto sm:max-h-20" />
        )}
        {isTenantHost() && tenantOrg && !whiteLabel ? (
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
