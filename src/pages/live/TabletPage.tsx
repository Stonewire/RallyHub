import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/helpers'

export function TabletPage() {
  const [searchParams] = useSearchParams()
  const orgId = searchParams.get('org')

  const [org, setOrg] = useState<Tables<'organizations'> | null>(null)
  const [events, setEvents] = useState<Tables<'events'>[]>([])
  const [loading, setLoading] = useState(true)
  const [inEvent, setInEvent] = useState<string | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    void (async () => {
      const { data: o } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle()
      setOrg(o)
      const { data: ev } = await supabase
        .from('events')
        .select('*')
        .eq('organization_id', orgId)
        .in('status', ['active', 'ready'])
        .order('event_date', { ascending: true })
      setEvents(ev ?? [])
      setLoading(false)
    })()
  }, [orgId])

  if (!orgId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <p>
          Add <code className="font-mono">?org=ORGANIZATION_ID</code> to the URL.
        </p>
      </div>
    )
  }

  if (inEvent) {
    return (
      <div className="relative min-h-screen">
        <button
          type="button"
          className="fixed top-2 right-2 z-50 rounded px-2 py-1 text-[10px] opacity-[0.12] hover:opacity-40"
          onClick={() => setExitOpen(true)}
        >
          exit
        </button>
        <iframe
          title="Event"
          src={`/join/${inEvent}`}
          className="size-full min-h-screen border-0"
        />
        {exitOpen ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <Card
              className={`w-full max-w-xs space-y-4 p-6 ${shake ? 'animate-shake' : ''}`}
            >
              <p className="text-sm font-medium">Tablet password</p>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setExitOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    if (password === (org?.tablet_password ?? '')) {
                      setInEvent(null)
                      setExitOpen(false)
                      setPassword('')
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
    <div className="bg-background flex min-h-screen flex-col items-center p-6">
      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          {org?.logo_url ? (
            <img src={org.logo_url} alt="" className="mb-4 max-h-24 object-contain" />
          ) : null}
          <h1 className="mb-8 text-2xl font-bold">{org?.name ?? 'Organization'}</h1>
          {events.length === 0 ? (
            <p className="text-muted-foreground">No active events.</p>
          ) : (
            <ul className="w-full max-w-md space-y-3">
              {events.map((ev) => (
                <li key={ev.id}>
                  <Button
                    variant="outline"
                    className="h-auto w-full flex-col py-4"
                    onClick={() => setInEvent(ev.id)}
                  >
                    <span className="font-semibold">{ev.name}</span>
                    <span className="text-muted-foreground text-xs capitalize">
                      {ev.status}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
