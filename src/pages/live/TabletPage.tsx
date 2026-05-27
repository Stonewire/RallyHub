import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { LivePanelShell } from '@/components/layout/LivePanelShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { TenantPublicOrg } from '@/lib/tenant'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/helpers'

async function resolveOrganization(
  orgParam: string,
): Promise<TenantPublicOrg | null> {
  const { data, error } = await supabase
    .from('organization_tenant_public')
    .select('*')
    .or(`tablet_slug.eq.${orgParam},subdomain.eq.${orgParam},id.eq.${orgParam}`)
    .maybeSingle()

  if (error) throw error
  return data
}

export function TabletPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const orgParam = searchParams.get('org')?.trim() ?? ''

  const [org, setOrg] = useState<TenantPublicOrg | null>(null)
  const [events, setEvents] = useState<Tables<'events'>[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!orgParam) {
      setLoading(false)
      setLoadError('Missing organization in URL.')
      return
    }

    setLoading(true)
    setLoadError(null)

    try {
      const organization = await resolveOrganization(orgParam)
      if (!organization) {
        setLoadError('Organization not found. Check the tablet link.')
        setOrg(null)
        setEvents([])
        setLoading(false)
        return
      }

      setOrg(organization)

      const { data: ev, error: evError } = await supabase
        .from('events')
        .select('*')
        .eq('organization_id', organization.id)
        .in('status', ['active', 'ready'])
        .order('event_date', { ascending: true, nullsFirst: false })

      if (evError) throw evError
      setEvents(ev ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load events')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [orgParam])

  useEffect(() => {
    void loadData()
  }, [loadData])

  if (!orgParam) {
    return (
      <LivePanelShell title="Tablet">
        <Card className="border-border/80 bg-card p-6 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            Add <code className="font-mono">?org=TABLET_SLUG</code> to the URL.
          </p>
        </Card>
      </LivePanelShell>
    )
  }

  if (loading) {
    return (
      <LivePanelShell title="Tablet">
        <p className="text-muted-foreground text-center text-sm">Loading events…</p>
      </LivePanelShell>
    )
  }

  if (loadError) {
    return (
      <LivePanelShell title="Tablet">
        <Card className="border-border/80 bg-card p-6 text-center shadow-sm">
          <p className="text-destructive text-sm">{loadError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => void loadData()}
          >
            Retry
          </Button>
        </Card>
      </LivePanelShell>
    )
  }

  return (
    <LivePanelShell title={org?.name ?? 'Tablet'}>
      {org?.logo_url ? (
        <img
          src={org.logo_url}
          alt=""
          className="mx-auto mb-6 max-h-16 object-contain"
        />
      ) : null}
      <div className="mx-auto grid max-w-lg gap-3">
        {events.length === 0 ? (
          <p className="text-muted-foreground text-center text-sm">
            No active events right now.
          </p>
        ) : (
          events.map((ev) => (
            <Button
              key={ev.id}
              type="button"
              variant="outline"
              className="h-auto py-4"
              onClick={() =>
                navigate(
                  `/join/${ev.id}?from=tablet&org=${encodeURIComponent(orgParam)}`,
                )
              }
            >
              {ev.name}
            </Button>
          ))
        )}
      </div>
    </LivePanelShell>
  )
}
