import { Download } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { AccentButton } from '@/components/admin/AccentButton'
import { LivePanelShell } from '@/components/layout/LivePanelShell'
import { PageScopedManifest } from '@/components/pwa/PageScopedManifest'
import { useInstallAction } from '@/components/pwa/use-install-action'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useWakeLock } from '@/hooks/use-wake-lock'
import { setAppLanguage } from '@/lib/i18n'
import { getTabletLink, slugifyOrgName } from '@/lib/tablet-link'
import { resolveTabletOrganization } from '@/lib/organization-tenant'
import type { TenantPublicOrg } from '@/lib/tenant'
import { supabase } from '@/lib/supabase'
import { verifyTabletPassword, validateTabletSession } from '@/lib/tenant'
import type { Tables } from '@/types/helpers'

const tabletSessionKey = (orgId: string) => `rallyhub_tablet_auth_${orgId}`

async function fetchTabletEvents(
  organizationId: string,
  token: string,
): Promise<Tables<'events'>[]> {
  const { data, error } = await supabase.rpc('get_tablet_events_for_org', {
    p_org_id: organizationId,
    p_token: token,
  })
  if (error) throw error
  return (data ?? []) as Tables<'events'>[]
}

export function TabletPage() {
  const { t } = useTranslation('live')
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
  const install = useInstallAction('tablet')
  useWakeLock()

  useDocumentTitle(t('tablet.documentTitle'), org?.name)

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
      setLoadError(t('tablet.missingOrg'))
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
      setLoadError(t('tablet.orgNotFound'))
      setLoading(false)
      return
    }

    setOrg(organization as TenantPublicOrg)
    // The kiosk is an org-level screen (it lists events that may differ in
    // language), so its own chrome follows the org's default, not any one event.
    void setAppLanguage((organization as TenantPublicOrg).default_language)
    // Validate stored token server-side; fall back to unauthed on any failure
    const storedToken = sessionStorage.getItem(tabletSessionKey(organization.id))
    let validToken: string | null = null
    if (storedToken) {
      const valid = await validateTabletSession(organization.id, storedToken).catch(() => false)
      if (!valid) sessionStorage.removeItem(tabletSessionKey(organization.id))
      validToken = valid ? storedToken : null
      setAuthed(Boolean(validToken))
    } else {
      setAuthed(false)
    }

    if (!validToken) {
      setEvents([])
      setLoading(false)
      return
    }

    try {
      setEvents(await fetchTabletEvents(organization.id, validToken))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('tablet.failedToLoad'))
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [orgSlug, tabletCode, legacyOrgParam, t])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount/dependency-change pattern; loadData's setState calls happen after an await, not synchronously
    void loadData()
  }, [loadData])

  async function handleTabletLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!org) return
    setCheckingIn(true)
    setAuthError(null)
    try {
      const token = await verifyTabletPassword(org.id, password)
      if (!token) {
        setAuthError(t('tablet.incorrectPassword'))
        return
      }
      const nextEvents = await fetchTabletEvents(org.id, token)
      sessionStorage.setItem(tabletSessionKey(org.id), token)
      setEvents(nextEvents)
      setAuthed(true)
      setPassword('')
      if (orgSlug && tabletCode) return
      navigate(getTabletLink(org), { replace: true })
    } catch {
      setAuthError(t('tablet.verifyFailed'))
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
      <LivePanelShell title={t('tablet.fallbackTitle')}>
        <Card className="border-border/80 bg-card p-6 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            {t('tablet.openLinkHint')}{' '}
            <code className="font-mono text-xs">/tablet/org-name/access-code</code>
          </p>
        </Card>
      </LivePanelShell>
    )
  }

  if (loading) {
    return (
      <LivePanelShell title={t('tablet.fallbackTitle')}>
        <p className="text-muted-foreground text-center text-sm">{t('common:loading')}…</p>
      </LivePanelShell>
    )
  }

  if (loadError) {
    return (
      <LivePanelShell title={t('tablet.fallbackTitle')}>
        <Card className="border-border/80 bg-card p-6 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">{loadError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => void loadData()}
          >
            {t('common:retry')}
          </Button>
        </Card>
      </LivePanelShell>
    )
  }

  if (!authed) {
    return (
      <LivePanelShell title={org?.name ?? t('tablet.fallbackTitle')}>
        <PageScopedManifest />
        {org?.logo_url ? (
          <img
            src={org.logo_url}
            alt=""
            className="mx-auto mb-6 max-h-16 object-contain"
          />
        ) : null}
        <Card className="border-border/80 mx-auto max-w-sm space-y-4 bg-card p-6 shadow-sm">
          <p className="text-muted-foreground text-center text-sm">
            {t('tablet.passwordHint')}
          </p>
          <form className="space-y-4" onSubmit={(e) => void handleTabletLogin(e)}>
            <div className="space-y-2">
              <Label htmlFor="tablet-login-pw">{t('tablet.password')}</Label>
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
              {checkingIn ? t('tablet.signingIn') : t('tablet.continueButton')}
            </AccentButton>
          </form>
          {/* Offered before the password too: this screen is where a kiosk gets
              set up, and the person doing it is the one who wants the icon. */}
          {install.method ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={install.onClick}
            >
              <Download className="size-4" />
              {t('tablet.installOnDevice')}
            </Button>
          ) : null}
          {install.guide}
        </Card>
      </LivePanelShell>
    )
  }

  return (
    <LivePanelShell title={org?.name ?? t('tablet.fallbackTitle')}>
      {/* A kiosk is a dedicated device, so its icon should reopen this exact
          tablet link rather than the app root. */}
      <PageScopedManifest />
      <div className="mb-4 flex justify-end gap-2">
        {install.method ? (
          <Button type="button" variant="outline" size="sm" onClick={install.onClick}>
            <Download className="size-4" />
            {t('tablet.install')}
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
          {t('tablet.logOut')}
        </Button>
      </div>
      {install.guide}
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
            {t('tablet.noEvents')}
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
          {t('tablet.bookmark', { path: tabletPath })}
        </p>
      ) : null}
    </LivePanelShell>
  )
}
