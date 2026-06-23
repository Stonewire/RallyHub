import { useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { fetchOrganizationTenantBySubdomain } from '@/lib/organization-tenant'
import { slugifyOrgName } from '@/lib/tablet-link'
import { supabase } from '@/lib/supabase'

function NotFound({ what }: { what: string }) {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-foreground text-2xl font-bold">{what} not found</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        This link may have changed. Ask the organiser for an updated link.
      </p>
    </div>
  )
}

/**
 * Pretty shareable event URL → resolves /client/events/event/{surface} to the
 * underlying event id, then forwards to the real /surface/:eventId page (which
 * is left untouched). Keeps the slug URL as the thing printed/QR'd while the
 * working pages stay exactly as they are.
 */
export function SlugEventRedirect({ surface }: { surface: 'facilitator' | 'display' | 'join' }) {
  const { clientSlug, eventSlug } = useParams<{ clientSlug: string; eventSlug: string }>()
  const query = useQuery({
    queryKey: ['resolve-event-by-slugs', clientSlug, eventSlug],
    enabled: Boolean(clientSlug && eventSlug),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('resolve_event_by_slugs', {
        p_client_slug: clientSlug!,
        p_event_slug: eventSlug!,
      })
      if (error) throw error
      return (data as string | null) ?? null
    },
  })

  if (query.isLoading) return <AuthLoadingScreen label="Loading" />
  if (!query.data) return <NotFound what="Event" />
  return <Navigate to={`/${surface}/${query.data}`} replace />
}

/** Pretty tablet URL → /client/tablet resolves the org and forwards to the
 *  working /tablet/:orgSlug/:tabletCode kiosk route. */
export function TabletSlugRedirect() {
  const { clientSlug } = useParams<{ clientSlug: string }>()
  const query = useQuery({
    queryKey: ['resolve-org-tablet', clientSlug],
    enabled: Boolean(clientSlug),
    queryFn: () => fetchOrganizationTenantBySubdomain(clientSlug!),
  })

  if (query.isLoading) return <AuthLoadingScreen label="Loading" />
  const org = query.data
  if (!org) return <NotFound what="Tablet" />
  const orgSlug = slugifyOrgName(org.name) || 'org'
  return (
    <Navigate
      to={`/tablet/${encodeURIComponent(orgSlug)}/${encodeURIComponent(org.tablet_slug)}`}
      replace
    />
  )
}
