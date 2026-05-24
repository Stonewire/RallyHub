import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { LivePanelShell } from '@/components/layout/LivePanelShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/helpers'

export function TabletPage() {
  const [searchParams] = useSearchParams()
  const orgId = searchParams.get('org')?.trim() ?? ''

  const [org, setOrg] = useState<Tables<'organizations'> | null>(null)
  const [events, setEvents] = useState<Tables<'events'>[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [inEvent, setInEvent] = useState<string | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [shake, setShake] = useState(false)

  const loadData = useCallback(async () => {
    if (!orgId) {
      setLoading(false)
      setLoadError('Missing organization ID in URL.')
      return
    }

    setLoading(true)
    setLoadError(null)

    const { data: o, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle()

    if (orgError) {
      setLoadError(orgError.message)
      setLoading(false)
      return
    }

    if (!o) {
      setLoadError('Organization not found. Check the org ID in the URL.')
      setLoading(false)
      return
    }

    setOrg(o)

    const { data: ev, error: evError } = await supabase
      .from('events')
      .select('*')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .order('event_date', { ascending: true, nullsFirst: false })

    if (evError) {
      setLoadError(evError.message)
    } else {
      setEvents(ev ?? [])
    }

    setLoading(false)
  }, [orgId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  if (!orgId) {
    return (
      <LivePanelShell title="Tablet">
        <Card className="border-border/80 bg-card p-6 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            Add <code className="font-mono">?org=ORGANIZATION_ID</code> to the URL.
          </p>
        </Card>
      </LivePanelShell>
    )
  }

  if (inEvent) {
    return (
      <div className="bg-background relative min-h-screen">
        <button
          type="button"
          aria-label="Exit event"
          className="fixed top-2 right-2 z-50 rounded px-2 py-1 text-[10px] text-foreground opacity-[0.12] hover:opacity-40"
          onClick={() => setExitOpen(true)}
        >
          exit
        </button>
        <iframe
          title="Join event"
          src={`/join/${inEvent}`}
          className="size-full min-h-screen border-0"
        />
        {exitOpen ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <Card
              className={`border-border/80 w-full max-w-xs space-y-4 bg-card p-6 shadow-lg ${shake ? 'animate-shake' : ''}`}
            >
              <p className="text-foreground text-sm font-medium">Tablet password</p>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (password === (org?.tablet_password ?? '')) {
                      setInEvent(null)
                      setExitOpen(false)
                      setPassword('')
                      void loadData()
                    } else {
                      setShake(true)
                      window.setTimeout(() => setShake(false), 500)
                    }
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setExitOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => {
                    if (password === (org?.tablet_password ?? '')) {
                      setInEvent(null)
                      setExitOpen(false)
                      setPassword('')
                      void loadData()
                    } else {
                      setShake(true)
                      window.setTimeout(() => setShake(false), 500)
                    }
                  }}
                >
                  OK
                </Button>
              </div>
            </Card>
            <style>{`
              @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-8px); }
                75% { transform: translateX(8px); }
              }
              .animate-shake { animation: shake 0.4s ease-in-out; }
            `}</style>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <LivePanelShell
      title={org?.name ?? 'Tablet'}
      subtitle="Select an active event for participants to join"
    >
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading events…</p>
      ) : loadError ? (
        <Card className="border-border/80 bg-card p-6 shadow-sm">
          <p className="text-destructive text-sm" role="alert">
            {loadError}
          </p>
        </Card>
      ) : (
        <>
          {org?.logo_url ? (
            <img
              src={org.logo_url}
              alt=""
              className="mx-auto mb-8 max-h-24 object-contain"
            />
          ) : null}
          {events.length === 0 ? (
            <Card className="border-border/80 bg-card p-8 text-center shadow-sm">
              <p className="text-muted-foreground text-sm">
                No active events for this organization.
              </p>
              <p className="text-muted-foreground mt-2 text-xs">
                Set an event status to <strong>Active</strong> in admin to show it here.
              </p>
            </Card>
          ) : (
            <ul className="mx-auto w-full max-w-md space-y-3">
              {events.map((ev) => (
                <li key={ev.id}>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-border/80 h-auto w-full flex-col bg-card py-4 shadow-sm"
                    onClick={() => setInEvent(ev.id)}
                  >
                    <span className="text-foreground font-semibold">{ev.name}</span>
                    {ev.event_date ? (
                      <span className="text-muted-foreground text-xs">
                        {new Date(ev.event_date).toLocaleString()}
                      </span>
                    ) : null}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </LivePanelShell>
  )
}
