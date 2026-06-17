import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { AccentButton } from '@/components/admin/AccentButton'
import { LivePanelShell } from '@/components/layout/LivePanelShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getTabletLink, slugifyOrgName } from '@/lib/tablet-link'
import { resolveTabletOrganization } from '@/lib/organization-tenant'
import type { TenantPublicOrg } from '@/lib/tenant'
import { supabase } from '@/lib/supabase'
import { verifyTabletPassword } from '@/lib/tenant'
import type { Tables } from '@/types/helpers'

const tabletSessionKey = (orgId: string) => `rallyhub_tablet_auth_${orgId}`

const TABLET_NOT_FOUND_MESSAGE =
  'Organization not found. Check your tablet link from Settings — the URL may be outdated.'

export function TabletPage() {
  const { orgSlug, tabletCode } = useParams<{
    orgSlug?: string
    tabletCode?: string
  }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const legacyOrgParam = searchParams.get('org')?.trim() ?? ''

  const [org, setOrg] = useState<TenantPublicOrg | null>(null)
  const [events, setEvents] = useState<Tables<'events'>[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [checkingIn, setCheckingIn] = useState(false)

  const tabletPath =
    org != null
      ? `/tablet/${encodeURIComponent(slugifyOrgName(org.name))}/${encodeURIComponent(org.tablet_slug)}`
      : orgSlug && tabletCode
        ? `/tablet/${encodeURIComponent(orgSlug)}/${encodeURIComponent(tabletCode)}`
        : legacyOrgParam
          ? `/tablet?org=${encodeURIComponent(legacyOrgParam)}`
          : ''

  const loadData = useCallback(async () => {
    const hasPath = Boolean((orgSlug && tabletCode) || legacyOrgParam)
    if (!hasPath) {
      setLoading(false)
      setLoadError('Missing organization in URL.')
      return
    }

    setLoading(true)
    setLoadError(null)

    const organization = await resolveTabletOrganization(
      orgSlug,
      tabletCode,
      legacyOrgParam,
    )
    if (!organization) {
      setOrg(null)
      setEvents([])
      setLoadError(TABLET_NOT_FOUND_MESSAGE)
      setLoading(false)
      return
    }

    setOrg(organization as TenantPublicOrg)
    setAuthed(sessionStorage.getItem(tabletSessionKey(organization.id)) === '1')

    try {
      const { data: ev, error: evError } = await supabase.rpc('get_tablet_events_for_org', {
        p_org_id: organization.id,
      })

      if (evError) throw evError
      setEvents((ev ?? []) as Tables<'events'>[])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load events')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [orgSlug, tabletCode, legacyOrgParam])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleTabletLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!org) return
    setCheckingIn(true)
    setAuthError(null)
    try {
      const ok = await verifyTabletPassword(org.id, password)
      if (!ok) {
        setAuthError('Incorrect password')
        return
      }
      sessionStorage.setItem(tabletSessionKey(org.id), '1')
      setAuthed(true)
      setPassword('')
      if (orgSlug && tabletCode) return
      navigate(getTabletLink(org), { replace: true })
    } catch {
      setAuthError('Could not verify password')
    } finally {
      setCheckingIn(false)
    }
  }

  function handleLogout() {
    if (org) sessionStorage.removeItem(tabletSessionKey(org.id))
    setAuthed(false)
    setPassword('')
  }

  if (!orgSlug && !tabletCode && !legacyOrgParam) {
    return (
      <LivePanelShell title="Tablet">
        <Card className="border-border/80 bg-card p-6 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            Open your organization tablet link from Settings, or use{' '}
            <code className="font-mono text-xs">/tablet/org-name/access-code</code>
          </p>
        </Card>
      </LivePanelShell>
    )
  }

  if (loading) {
    return (
      <LivePanelShell title="Tablet">
        <p className="text-muted-foreground text-center text-sm">Loading…</p>
      </LivePanelShell>
    )
  }

  if (loadError) {
    return (
      <LivePanelShell title="Tablet">
        <Card className="border-border/80 bg-card p-6 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">{loadError}</p>
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

  if (!authed) {
    return (
      <LivePanelShell title={org?.name ?? 'Tablet'}>
        {org?.logo_url ? (
          <img
            src={org.logo_url}
            alt=""
            className="mx-auto mb-6 max-h-16 object-contain"
          />
        ) : null}
        <Card className="border-border/80 mx-auto max-w-sm space-y-4 bg-card p-6 shadow-sm">
          <p className="text-muted-foreground text-center text-sm">
            Enter the tablet password to view active events.
          </p>
          <form className="space-y-4" onSubmit={(e) => void handleTabletLogin(e)}>
            <div className="space-y-2">
              <Label htmlFor="tablet-login-pw">Tablet password</Label>
              <Input
                id="tablet-login-pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background"
              />
            </div>
            {authError ? (
              <p className="text-destructive text-sm" role="alert">
                {authError}
              </p>
            ) : null}
            <AccentButton
              type="submit"
              className="w-full"
              disabled={checkingIn || !password.trim()}
            >
              {checkingIn ? 'Signing in…' : 'Continue'}
            </AccentButton>
          </form>
        </Card>
      </LivePanelShell>
    )
  }

  return (
    <LivePanelShell title={org?.name ?? 'Tablet'}>
      <div className="mb-4 flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
          Log out
        </Button>
      </div>
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
              onClick={() => {
                const q = new URLSearchParams({
                  from: 'tablet',
                  org: slugifyOrgName(org!.name),
                  slug: org!.tablet_slug,
                })
                navigate(`/join/${ev.id}?${q.toString()}`)
              }}
            >
              {ev.name}
            </Button>
          ))
        )}
      </div>
      {tabletPath ? (
        <p className="text-muted-foreground mt-8 text-center text-xs">
          Bookmark: {tabletPath}
        </p>
      ) : null}
    </LivePanelShell>
  )
}
