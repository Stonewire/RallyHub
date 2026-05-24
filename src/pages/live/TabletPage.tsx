import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { LivePanelShell } from '@/components/layout/LivePanelShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { TenantPublicOrg } from '@/lib/tenant'
import { verifyTabletPassword } from '@/lib/tenant'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/helpers'

export function TabletPage() {
  const [searchParams] = useSearchParams()
  const orgParam = searchParams.get('org')?.trim() ?? ''

  const [org, setOrg] = useState<(TenantPublicOrg & { id: string }) | null>(null)
  const [events, setEvents] = useState<Tables<'events'>[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [inEvent, setInEvent] = useState<string | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [shake, setShake] = useState(false)

  const loadData = useCallback(async () => {
    if (!orgParam) {
      setLoading(false)
      setLoadError('Missing organization in URL.')
      return
    }

    setLoading(true)
    setLoadError(null)

    const bySlug = await supabase
      .from('organization_tenant_public')
      .select('*')
      .eq('tablet_slug', orgParam)
      .maybeSingle()

    let organization = bySlug.data

    if (!organization && !bySlug.error) {
      const byId = await supabase
        .from('organization_tenant_public')
        .select('*')
        .eq('id', orgParam)
        .maybeSingle()
      if (byId.error) {
        setLoadError(byId.error.message)
        setLoading(false)
        return
      }
      organization = byId.data
    } else if (bySlug.error) {
      setLoadError(bySlug.error.message)
      setLoading(false)
      return
    }

    if (!organization) {
      setLoadError('Organization not found. Check the tablet link.')
      setLoading(false)
      return
    }

    setOrg(organization)

    const { data: ev, error: evError } = await supabase
      .from('events')
      .select('*')
      .eq('organization_id', organization.id)
      .eq('status', 'active')
      .order('event_date', { ascending: true, nullsFirst: false })

    if (evError) {
      setLoadError(evError.message)
    } else {
      setEvents(ev ?? [])
    }

    setLoading(false)
  }, [orgParam])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function confirmExit() {
    if (!org) return
    const ok = await verifyTabletPassword(org.id, password)
    if (!ok) {
      setShake(true)
      window.setTimeout(() => setShake(false), 400)
      return
    }
    setPassword('')
    setExitOpen(false)
    setInEvent(null)
  }

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
        </Card>
      </LivePanelShell>
    )
  }

  if (inEvent) {
    return (
      <div className="bg-background relative min-h-svh">
        <iframe
          title="Join event"
          src={`/join/${inEvent}`}
          className="size-full min-h-svh border-0"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="absolute top-3 right-3 z-10"
          onClick={() => setExitOpen(true)}
        >
          Exit
        </Button>
        {exitOpen ? (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
            <Card
              className={`border-border/80 w-full max-w-xs space-y-3 bg-card p-6 shadow-lg ${shake ? 'animate-pulse' : ''}`}
            >
              <p className="font-medium">Tablet password</p>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setExitOpen(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={() => void confirmExit()}>
                  Confirm
                </Button>
              </div>
            </Card>
          </div>
        ) : null}
      </div>
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
          <p className="text-muted-foreground text-center text-sm">No active events.</p>
        ) : (
          events.map((ev) => (
            <Button
              key={ev.id}
              type="button"
              variant="outline"
              className="h-auto py-4"
              onClick={() => setInEvent(ev.id)}
            >
              {ev.name}
            </Button>
          ))
        )}
      </div>
    </LivePanelShell>
  )
}
