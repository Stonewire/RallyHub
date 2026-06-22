import { Check, Copy, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useSearchParams } from 'react-router-dom'

import { NeoButton } from '@/components/neo-minimal'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { TeamUsersPanel } from '@/components/admin/TeamUsersPanel'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOrganizationId } from '@/hooks/use-organization-id'
import { TabletLinkEditor } from '@/components/admin/TabletLinkEditor'
import {
  EMPTY_ORG_FORM,
  getTabletLink,
  orgToForm,
  uploadOrganizationLogo,
  useOrganization,
  useSaveOrganization,
  useSaveOrganizationLogo,
  type OrganizationFormState,
} from '@/hooks/use-organization-settings'
import { BillingOverview } from '@/components/billing/BillingOverview'
import { useNotification } from '@/contexts/notification-context'
import { copyToClipboard } from '@/lib/clipboard'
import { validateTabletCode } from '@/lib/tablet-link'
import { cn } from '@/lib/utils'

type SettingsTab = 'profile' | 'billing'

export function AdminSettingsPage() {
  const organizationId = useOrganizationId()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: SettingsTab = tabParam === 'billing' ? 'billing' : 'profile'

  const { notify } = useNotification()
  const orgQuery = useOrganization(organizationId)
  const saveOrg = useSaveOrganization(organizationId)
  const saveLogo = useSaveOrganizationLogo(organizationId)

  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<OrganizationFormState>(EMPTY_ORG_FORM)
  const [copied, setCopied] = useState(false)
  const [passwordCopied, setPasswordCopied] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)

  useEffect(() => {
    if (orgQuery.data) {
      setForm(orgToForm(orgQuery.data))
    }
  }, [orgQuery.data])

  // F10: warn before leaving Settings with unsaved profile changes.
  const dirty = orgQuery.data
    ? JSON.stringify(form) !== JSON.stringify(orgToForm(orgQuery.data))
    : false
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  )

  if (!organizationId) {
    return (
      <AdminPageShell title="Org Settings" subtitle="Manage your organization.">
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  const tabletLink = orgQuery.data ? getTabletLink(orgQuery.data) : ''

  async function handleSave(onSaved?: () => void) {
    setSaveMessage(null)
    const tabletErr = validateTabletCode(form.tablet_slug)
    if (tabletErr) {
      setSaveMessage(tabletErr)
      return
    }
    try {
      await saveOrg.mutateAsync(form)
      setSaveMessage('Settings saved.')
      onSaved?.()
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : 'Failed to save settings.',
      )
    }
  }

  async function handleLogoChange(file: File | undefined) {
    if (!file || !organizationId) return
    setLogoUploading(true)
    setSaveMessage(null)
    try {
      const url = await uploadOrganizationLogo(organizationId, file)
      setForm((f) => ({ ...f, logo_url: url }))
      await saveLogo.mutateAsync(url)
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : 'Failed to upload logo.',
      )
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleCopyLink() {
    if (!tabletLink) return
    if (!(await copyToClipboard(tabletLink))) {
      notify('Could not copy — copy it manually')
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  async function handleCopyPassword() {
    const password = form.tablet_password.trim() || '1234'
    if (!(await copyToClipboard(password))) {
      notify('Could not copy — copy it manually')
      return
    }
    setPasswordCopied(true)
    window.setTimeout(() => setPasswordCopied(false), 2000)
  }

  function setTab(next: SettingsTab) {
    setSearchParams(next === 'billing' ? { tab: 'billing' } : {})
  }

  const profileLoading = orgQuery.isLoading
  const profileReady = orgQuery.isFetched

  return (
    <AdminPageShell
      title="Org Settings"
      subtitle="Organization profile, team, tablet access, and billing."
      actions={
        tab === 'profile' ? (
          <NeoButton
            type="button"
            variant="primary"
            disabled={saveOrg.isPending}
            onClick={() => void handleSave()}
          >
            {saveOrg.isPending ? 'Saving…' : 'Save'}
          </NeoButton>
        ) : null
      }
    >
      <div className="neo-tabs border-border/80 mb-8 flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setTab('profile')}
          className={cn(
            'neo-tab px-4 py-2 text-sm font-medium',
            tab === 'profile' ? 'neo-tab-active' : '',
          )}
        >
          Organization Profile
        </button>
        <button
          type="button"
          onClick={() => setTab('billing')}
          className={cn(
            'neo-tab px-4 py-2 text-sm font-medium',
            tab === 'billing' ? 'neo-tab-active' : '',
          )}
        >
          Billing
        </button>
      </div>

      {profileLoading && !profileReady ? (
        <QueryLoading rows={4} />
      ) : orgQuery.isError ? (
        <QueryError message={orgQuery.error.message} />
      ) : tab === 'billing' ? (
        <BillingOverview
          organizationId={organizationId}
          billingPlan={orgQuery.data?.billing_plan}
          billingPeriod={orgQuery.data?.billing_period}
          showAvailablePlans
        />
      ) : (
        <div className="space-y-8">
          {!orgQuery.data ? (
            <p className="text-muted-foreground text-sm">
              Organization record not found. Saving will update once the record
              exists in Supabase.
            </p>
          ) : null}
          {saveMessage ? (
            <p
              className={cn(
                'text-sm',
                saveMessage.includes('saved')
                  ? 'text-foreground'
                  : 'text-destructive',
              )}
              role="status"
            >
              {saveMessage}
            </p>
          ) : null}

          <Card className="border-border/80 space-y-5 bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-background"
              />
            </div>

            <div className="space-y-3">
              <Label>Logo</Label>
              <div className="flex flex-wrap items-center gap-4">
                {form.logo_url ? (
                  <img
                    src={form.logo_url}
                    alt="Organization logo"
                    className="border-border/80 size-16 rounded-lg border object-contain"
                  />
                ) : (
                  <div className="bg-muted/50 text-muted-foreground flex size-16 items-center justify-center rounded-lg text-xs">
                    No logo
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    void handleLogoChange(e.target.files?.[0])
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={logoUploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="size-4" />
                  {logoUploading ? 'Uploading…' : 'Upload logo'}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ['primary_color', 'Primary'],
                  ['secondary_color', 'Secondary'],
                  ['accent_color', 'Accent'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id={key}
                      type="color"
                      value={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                      className="border-border/80 size-10 cursor-pointer rounded-md border bg-transparent"
                    />
                    <Input
                      value={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                      className="bg-background font-mono text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
            <h2 className="text-foreground text-lg font-semibold">
              Company Details
            </h2>
            <div className="space-y-2">
              <Label htmlFor="vat">VAT</Label>
              <Input
                id="vat"
                value={form.vat_number}
                onChange={(e) =>
                  setForm({ ...form, vat_number: e.target.value })
                }
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-street">Street Address</Label>
              <Input
                id="address-street"
                value={form.address_street}
                onChange={(e) =>
                  setForm({ ...form, address_street: e.target.value })
                }
                className="bg-background"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="address-city">City</Label>
                <Input
                  id="address-city"
                  value={form.address_city}
                  onChange={(e) =>
                    setForm({ ...form, address_city: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address-state">State or Region</Label>
                <Input
                  id="address-state"
                  value={form.address_state}
                  onChange={(e) =>
                    setForm({ ...form, address_state: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="address-postal">Postal Code</Label>
                <Input
                  id="address-postal"
                  value={form.address_postal}
                  onChange={(e) =>
                    setForm({ ...form, address_postal: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address-country">Country</Label>
                <Input
                  id="address-country"
                  value={form.address_country}
                  onChange={(e) =>
                    setForm({ ...form, address_country: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
            </div>
          </Card>

          <TeamUsersPanel />

          <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
            <h2 className="text-foreground text-lg font-semibold">
              Tablet Access
            </h2>
            {orgQuery.data ? (
              <TabletLinkEditor
                orgName={form.name || orgQuery.data.name}
                tabletCode={form.tablet_slug}
                onCodeChange={(tablet_slug) => setForm({ ...form, tablet_slug })}
                subdomain={orgQuery.data.subdomain}
                customDomain={orgQuery.data.custom_domain}
              />
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="tablet-password">Tablet Password</Label>
              <div className="flex max-w-md gap-2">
                <Input
                  id="tablet-password"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.tablet_password}
                  onChange={(e) =>
                    setForm({ ...form, tablet_password: e.target.value })
                  }
                  className="bg-background flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleCopyPassword()}
                >
                  {passwordCopied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  Copy
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Shared venue code for the tablet kiosk. Defaults to 1234 if unchanged.
              </p>
            </div>
            {tabletLink ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void handleCopyLink()}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  Copy link
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to={tabletLink} target="_blank">
                    Open tablet page
                  </Link>
                </Button>
              </div>
            ) : null}
          </Card>
        </div>
      )}

      {tab === 'profile' && profileReady && !orgQuery.isError ? (
        <FormSaveFooter
          onSave={() => void handleSave()}
          saving={saveOrg.isPending}
          label="Save settings"
          dirty={dirty}
        />
      ) : null}

      {blocker.state === 'blocked' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="border-border/80 w-full max-w-sm space-y-4 bg-card p-6 shadow-lg">
            <div className="space-y-1">
              <h3 className="text-foreground font-semibold">Unsaved changes</h3>
              <p className="text-muted-foreground text-sm">
                You have unsaved changes to your settings. Save them before leaving?
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <NeoButton variant="surface" onClick={() => blocker.reset?.()}>
                Cancel
              </NeoButton>
              <NeoButton variant="surface" onClick={() => blocker.proceed?.()}>
                Don't save
              </NeoButton>
              <NeoButton
                variant="primary"
                disabled={saveOrg.isPending}
                onClick={() => void handleSave(() => blocker.proceed?.())}
              >
                {saveOrg.isPending ? 'Saving…' : 'Save & leave'}
              </NeoButton>
            </div>
          </Card>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
