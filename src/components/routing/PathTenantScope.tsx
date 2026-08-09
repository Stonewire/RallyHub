import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'

import { TenantProvider } from '@/contexts/tenant-context'

/**
 * Slug-based tenant resolution for the /:clientSlug/admin/* mount on
 * app.rallyhub.games — the path-tenancy sibling of TenantScope (which
 * resolves by host, used for admin.rallyhub.games and legacy subdomain
 * hosts). The clientSlug route param drives org lookup instead of the
 * hostname.
 */
export function PathTenantScope({ children }: { children: ReactNode }) {
  const { clientSlug } = useParams<{ clientSlug: string }>()
  return <TenantProvider subdomainOverride={clientSlug}>{children}</TenantProvider>
}
