import { IconBilling, IconDevice, IconDownload, IconExternal, IconUpload } from '@/components/icons'
import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useSearchParams } from 'react-router-dom'

import { NeoButton } from '@/components/neo-minimal'
import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { BrandColourPicker } from '@/components/admin/BrandColourPicker'
import { RallyHubStaffPanel } from '@/components/rallyhub/RallyHubStaffPanel'
import { useAuth } from '@/contexts/auth-context'
import { isPlatformOwner } from '@/lib/auth-routes'
import { isPlatformHost } from '@/lib/tenant'
import { DangerZone } from '@/components/admin/DangerZone'
import { MyAccountPanel } from '@/components/admin/MyAccountPanel'
import { TeamUsersPanel } from '@/components/admin/TeamUsersPanel'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOrganizationId } from '@/hooks/use-organization-id'
import {
  useCancelOrganizationDeletion,
  useOrganizationDeletionRequest,
  useRequestOrganizationDeletion,
} from '@/hooks/use-data-lifecycle'
import { TabletLinkEditor } from '@/components/admin/TabletLinkEditor'
import {
  EMPTY_ORG_FORM,
  orgToForm,
  uploadOrganizationLogo,
  useOrganization,
  useSaveOrganization,
  useSaveOrganizationLogo,
  type OrganizationFormState,
} from '@/hooks/use-organization-settings'
import { BillingOverview } from '@/components/billing/BillingOverview'
import { validateTabletCode } from '@/lib/tablet-link'
import { cn } from '@/lib/utils'
import { Combobox } from '@/components/admin/Combobox'
import { InstallGuide } from '@/components/pwa/InstallGuide'
import { COUNTRIES, postcodeExample, validatePostcode } from '@/lib/countries'
import { downloadClientPackage } from '@/lib/client-export'
import {
  ALLOWED_IMAGE_UPLOAD_LABEL,
  ALLOWED_IMAGE_UPLOAD_TYPES,
  UPLOAD_MAX_PHOTO_BYTES,
  formatUploadMaxLabel,
  validateImageUpload,
} from '@/lib/upload-limits'

type SettingsTab = 'profile' | 'billing' | 'account' | 'team'

const BRAND_COLOUR_COPY = {
  primary_color: 'Buttons, highlights & active states',
  secondary_color: 'Headers, nav & body text',
  accent_color: 'Borders, muted text & dividers',
} as const

function SettingsCardHeader({
  title,
  visibility,
}: {
  title: string
  visibility: 'Public' | 'Private'
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-foreground text-sm font-bold">{title}</h2>
      {/* Red for Public, green for Private: the colour is a warning about who
          can see the fields, not decoration. Public means participants see it. */}
      <span
        className={`rounded px-2 py-1 text-[10px] font-semibold ${
          visibility === 'Public'
            ? 'bg-[#f6dede] text-[#8a2b2b] dark:bg-[#4a2020] dark:text-[#f0b9b9]'
            : 'bg-[#d9efe3] text-[#1f6b48] dark:bg-[#1d3d2d] dark:text-[#a6dcc0]'
        }`}
      >
        {visibility}
      </span>
    </div>
  )
}

export function AdminSettingsPage() {
  const organizationId = useOrganizationId()
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const { role, profile } = useAuth()
  // The staff tab exists only for the platform owner; anyone else asking for
  // it lands on their own account instead.
  const isPlatformSuperAdmin = role === 'super_admin' && isPlatformHost()
  const canManageStaff = isPlatformSuperAdmin && isPlatformOwner(profile?.staff_role)
  // Platform staff have no organisation, so the org and billing tabs do not
  // exist for them; everything coerces to the account side.
  const tab: SettingsTab =
    tabParam === 'billing' && !isPlatformSuperAdmin
      ? 'billing'
      : tabParam === 'team' && canManageStaff
        ? 'team'
        : tabParam === 'account' || tabParam === 'team' || isPlatformSuperAdmin
          ? 'account'
          : 'profile'

  const orgQuery = useOrganization(organizationId)
  const saveOrg = useSaveOrganization(organizationId)
  const saveLogo = useSaveOrganizationLogo(organizationId)
  const deletionRequestQuery = useOrganizationDeletionRequest(organizationId)
  const requestDeletion = useRequestOrganizationDeletion(organizationId)
  const cancelDeletion = useCancelOrganizationDeletion(organizationId)

  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<OrganizationFormState>(EMPTY_ORG_FORM)
  const [installGuideOpen, setInstallGuideOpen] = useState(false)
  const postcodeError = validatePostcode(form.address_country, form.address_postal)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletionMessage, setDeletionMessage] = useState<string | null>(null)
  const [exportingData, setExportingData] = useState(false)
  const [logoDragging, setLogoDragging] = useState(false)

  useEffect(() => {
    if (orgQuery.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrates the local editable form from fetched data
      setForm(orgToForm(orgQuery.data))
    }
  }, [orgQuery.data])

  // F10: warn before leaving Settings with unsaved profile changes.
  const dirty = orgQuery.data
    ? JSON.stringify(form) !== JSON.stringify(orgToForm(orgQuery.data))
    : false
  // Organisation Device Access has its own Save, so it tracks only its own
  // fields. Using the page-wide dirty flag made that button appear after
  // editing an unrelated field like the organisation name, implying it saved
  // only the PIN.
  const tabletDirty = orgQuery.data
    ? form.tablet_password !== orgToForm(orgQuery.data).tablet_password ||
      form.tablet_slug !== orgToForm(orgQuery.data).tablet_slug
    : false
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  )

  // Platform staff have no organisation on purpose; their tabs (My Account,
  // Team) do not need one, so the guard only applies to client admins.
  if (!organizationId && !isPlatformSuperAdmin) {
    return (
      <AdminPageShell title="Org Settings" subtitle="Manage your organization.">
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  // P2-3: 1234 is the shipped default — block handing out the kiosk link until changed.
  const tabletPinIsDefault = (form.tablet_password.trim() || '1234') === '1234'

  async function handleSave(onSaved?: () => void) {
    setSaveMessage(null)
    // Only judge the tablet code if this save is actually changing it. An org
    // whose stored code predates the 1-10 character rule, which includes the
    // demo sandbox and its seeded "northstar-demo", could otherwise never save
    // anything at all: renaming the organisation would fail on a field the
    // user had not touched, with an error pointing somewhere else entirely.
    const tabletCodeChanged = form.tablet_slug !== (orgQuery.data?.tablet_slug ?? '')
    if (tabletCodeChanged) {
      const tabletErr = validateTabletCode(form.tablet_slug)
      if (tabletErr) {
        setSaveMessage(tabletErr)
        return
      }
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
    // The card advertises a type and size limit, so enforce it here rather
    // than letting Storage reject it with an opaque error.
    const problem = validateImageUpload(file, 'logo')
    if (problem) {
      setSaveMessage(problem)
      return
    }
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

  async function handleRequestDeletion() {
    setDeletionMessage(null)
    // The demo walks the whole flow, including this confirmation, but stops
    // here. The guard is deliberately before the mutation rather than hiding
    // the button, so there is one place to be sure the RPC is never reached.
    if (isDemo) {
      setDeleteConfirmOpen(false)
      setDeletionMessage(
        'This account cannot be deleted: it is the public demo, and it resets itself every 30 minutes.',
      )
      return
    }
    try {
      const result = await requestDeletion.mutateAsync()
      setDeleteConfirmOpen(false)
      setDeletionMessage(
        result.warning
          ? `Deletion is scheduled, but subscription cancellation needs attention: ${result.warning}`
          : 'Account deletion is scheduled. You can restore the account during the next 30 days.',
      )
    } catch (err) {
      setDeletionMessage(
        err instanceof Error ? err.message : 'Could not request account deletion.',
      )
    }
  }

  async function handleCancelDeletion() {
    setDeletionMessage(null)
    try {
      const result = await cancelDeletion.mutateAsync()
      if (result.restartSubscriptionRequired) {
        setDeletionMessage(
          'Account restored. The Paddle subscription had already ended, so start a new subscription from Billing before activating more events.',
        )
      } else if (result.warning) {
        setDeletionMessage(
          `Account restored. Check Billing because automatic renewal could not be restored: ${result.warning}`,
        )
      } else {
        setDeletionMessage('Account restored and automatic deletion canceled.')
      }
    } catch (err) {
      setDeletionMessage(
        err instanceof Error ? err.message : 'Could not restore the account.',
      )
    }
  }

  async function handleDownloadData() {
    if (!organizationId) return
    if (isDemo) {
      setSaveMessage(
        'Exporting is disabled in the public demo. On a real account this downloads every game, event, submission and uploaded file.',
      )
      return
    }
    setSaveMessage(null)
    setExportingData(true)
    try {
      await downloadClientPackage(organizationId)
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Could not download your data.')
    } finally {
      setExportingData(false)
    }
  }

  const profileLoading = orgQuery.isLoading
  const profileReady = orgQuery.isFetched
  const isDemo = orgQuery.data?.is_demo === true

  // The new design navigates these from the sidebar (Organisation, Billing) and
  // the header avatar (My Account), so the page carries no tab strip and titles
  // itself after whichever surface is active.
  const PAGE_COPY: Record<SettingsTab, { title: string; subtitle: string }> = {
    profile: {
      title: 'Organisation',
      subtitle: 'Brand identity, company details, team and tablet access.',
    },
    billing: {
      title: 'Billing',
      subtitle: 'Manage your plan and invoices.',
    },
    account: {
      title: 'My Account',
      subtitle: 'Manage your personal profile and security settings.',
    },
    team: {
      title: 'Team',
      subtitle: 'RallyHub staff and what each of them can do.',
    },
  }

  return (
    <AdminPageShell
      title={PAGE_COPY[tab].title}
      subtitle={PAGE_COPY[tab].subtitle}
      actions={
        tab === 'profile' ? (
          <>
            <NeoButton
              type="button"
              variant="surface"
              disabled={!dirty || saveOrg.isPending || !orgQuery.data}
              onClick={() => orgQuery.data && setForm(orgToForm(orgQuery.data))}
            >
              Discard
            </NeoButton>
            <NeoButton
              type="button"
              variant="primary"
              disabled={!dirty || saveOrg.isPending}
              onClick={() => void handleSave()}
            >
              {saveOrg.isPending ? 'Saving…' : 'Save'}
            </NeoButton>
          </>
        ) : null
      }
    >
      {profileLoading && !profileReady ? (
        <QueryLoading rows={4} />
      ) : orgQuery.isError ? (
        <QueryError message={orgQuery.error.message} />
      ) : tab === 'billing' ? (
        <BillingOverview
          organizationId={organizationId}
          billingPlan={orgQuery.data?.billing_plan}
          billingPeriod={orgQuery.data?.billing_period}
          paddleSubscriptionId={orgQuery.data?.paddle_subscription_id}
          showAvailablePlans
        />
      ) : tab === 'team' ? (
        <>
          <PlatformSettingsTabs active="team" />
          <RallyHubStaffPanel />
        </>
      ) : tab === 'account' ? (
        canManageStaff ? (
          <>
            <PlatformSettingsTabs active="account" />
            <MyAccountPanel />
          </>
        ) : isDemo ? (
          // The demo edits its own real profile. Everyone shares one login, but
          // the sandbox resets every 30 minutes and the demo signs in by magic
          // link rather than by password, so a name, photo, phone or password
          // change harms nothing. Only the email is held back: the sign-in
          // function looks the account up by it, so changing it would orphan
          // the login until the next reset.
          <div className="space-y-4">
            <Card className="border-border/80 bg-muted/20 px-4 py-3 shadow-sm">
              <p className="text-muted-foreground text-sm">
                This is a real account and your changes save, so try it. The
                sandbox resets every 30 minutes. Two things are held back: the
                email address, because the demo sign-in looks the account up by
                it, and deleting the login, which everyone here shares.
              </p>
            </Card>
            <MyAccountPanel demo />
          </div>
        ) : (
          <MyAccountPanel />
        )
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

          <div className="grid items-start gap-4 xl:grid-cols-2">
            <div className="flex flex-col gap-4">
              <Card
                className="border-border/80 space-y-4 bg-card p-4 shadow-sm"
                data-tour="org-profile-form"
              >
                <SettingsCardHeader title="Brand Identity" visibility="Public" />
                <div className="space-y-1.5">
                  <Label htmlFor="org-name">Organisation Name</Label>
                  <Input
                    id="org-name"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Your Organisation's Name"
                  />
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept={ALLOWED_IMAGE_UPLOAD_TYPES.join(',')}
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    void handleLogoChange(file)
                  }}
                />
                {/* A real drop target. The copy promised drag and drop long
                    before there were any drag handlers behind it. */}
                <button
                  type="button"
                  disabled={logoUploading}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault()
                    if (!logoDragging) setLogoDragging(true)
                  }}
                  onDragLeave={() => setLogoDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setLogoDragging(false)
                    void handleLogoChange(event.dataTransfer.files?.[0])
                  }}
                  className={cn(
                    'text-muted-foreground flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-md border-[1.5px] border-dashed px-4 py-6 text-center text-xs transition-colors',
                    logoDragging
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border hover:border-nm-slate-400 hover:bg-muted/20',
                  )}
                >
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Organization logo" className="max-h-20 max-w-48 object-contain" />
                  ) : (
                    <IconUpload className="size-5" />
                  )}
                  <span>
                    {logoUploading
                      ? 'Uploading…'
                      : logoDragging
                        ? 'Drop to upload'
                        : form.logo_url
                          ? 'Click or drop to replace your logo'
                          : 'Drag & drop your logo here'}
                  </span>
                  {/* SVG is intentionally absent: the bucket is public and an
                      SVG can carry script, so it is blocked server side too. */}
                  <span className="text-[10px]">
                    {ALLOWED_IMAGE_UPLOAD_LABEL} (Max {formatUploadMaxLabel(UPLOAD_MAX_PHOTO_BYTES)})
                  </span>
                </button>

                <div>
                  <p className="text-muted-foreground mb-2.5 text-center text-[11px] font-semibold tracking-[0.06em] uppercase">
                    Brand Colours
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {(
                      [
                        ['primary_color', 'Primary'],
                        ['secondary_color', 'Secondary'],
                        ['accent_color', 'Accent'],
                      ] as const
                    ).map(([key, label]) => (
                      <BrandColourPicker
                        key={key}
                        id={key}
                        label={label}
                        description={BRAND_COLOUR_COPY[key]}
                        value={form[key]}
                        onChange={(hex) => setForm({ ...form, [key]: hex })}
                      />
                    ))}
                  </div>
                </div>
              </Card>

              <Card className="border-border/80 space-y-4 bg-card p-4 shadow-sm">
                <SettingsCardHeader title="Legal & Billing Details" visibility="Private" />
                <div className="space-y-1.5">
                  <Label htmlFor="vat">Tax / VAT ID</Label>
                  <Input id="vat" value={form.vat_number} onChange={(event) => setForm({ ...form, vat_number: event.target.value })} placeholder="MT12341234" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address-street">Street</Label>
                  <Input id="address-street" value={form.address_street} onChange={(event) => setForm({ ...form, address_street: event.target.value })} placeholder="Number and street name" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="address-city">City</Label>
                    {/* Same control as Country, with nothing to suggest yet:
                        there is no city list in the app and no honest static one
                        to ship. Work plan covers what it would take. */}
                    <Combobox
                      id="address-city"
                      value={form.address_city}
                      onChange={(value) => setForm({ ...form, address_city: value })}
                      options={[]}
                      placeholder="Valletta"
                      autoComplete="address-level2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="address-country">Country</Label>
                    {/* Our own combobox rather than a native datalist, whose
                        popup the browser styles and positions itself. Typing
                        filters; free text is still accepted. */}
                    <Combobox
                      id="address-country"
                      value={form.address_country}
                      onChange={(value) => setForm({ ...form, address_country: value })}
                      // COUNTRIES, not countryOptions: that helper prepends the
                      // current value so a select could not blank an unknown
                      // saved country. A free-text combobox keeps the value
                      // anyway, and prepending made half-typed text appear as a
                      // suggestion of itself.
                      options={COUNTRIES}
                      placeholder="Start typing or pick from the list"
                      autoComplete="country-name"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="address-state">State or Region</Label>
                    <Input id="address-state" value={form.address_state} onChange={(event) => setForm({ ...form, address_state: event.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="address-postal">Post Code</Label>
                    {/* Format checked against the chosen country. Advisory, not
                        blocking: it catches a UK code typed into a German
                        address, but a real postcode lookup is a separate job. */}
                    <Input
                      id="address-postal"
                      value={form.address_postal}
                      onChange={(event) => setForm({ ...form, address_postal: event.target.value })}
                      placeholder={postcodeExample(form.address_country) || 'VLT 1234'}
                      aria-invalid={postcodeError ? true : undefined}
                      aria-describedby={postcodeError ? 'address-postal-error' : undefined}
                    />
                    {postcodeError ? (
                      <p id="address-postal-error" className="text-destructive text-xs">
                        {postcodeError}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Button type="button" variant="outline" className="w-full" asChild>
                  <Link to="/admin/settings?tab=billing">
                    <IconBilling className="size-4" />
                    Manage Payment Details
                    <IconExternal className="size-3.5" />
                  </Link>
                </Button>
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              <Card className="border-border/80 space-y-4 bg-card p-4 shadow-sm">
                <SettingsCardHeader title="Organisation Device Access" visibility="Public" />
                {orgQuery.data ? (
                  <TabletLinkEditor subdomain={orgQuery.data.subdomain} disabled={tabletPinIsDefault} />
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="tablet-password">Tablet Password (4 digits)</Label>
                  <Input
                    id="tablet-password"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    autoComplete="off"
                    value={form.tablet_password}
                    onChange={(event) => setForm({ ...form, tablet_password: event.target.value.replace(/\D/g, '').slice(0, 4) })}
                    className="max-w-32 font-semibold tracking-[0.3em]"
                  />
                  {tabletPinIsDefault ? (
                    <p className="text-destructive text-xs font-medium" role="alert">
                      Change the default password before sharing the tablet link.
                    </p>
                  ) : null}
                </div>
                <NeoButton
                  type="button"
                  variant="surface"
                  size="sm"
                  onClick={() => setInstallGuideOpen(true)}
                >
                  <IconDevice className="size-3.5" />
                  Instructions on how to install RallyHub on your device
                </NeoButton>
                {tabletDirty ? (
                  <NeoButton type="button" variant="primary" size="sm" disabled={saveOrg.isPending} onClick={() => void handleSave()}>
                    {saveOrg.isPending ? 'Saving…' : 'Save'}
                  </NeoButton>
                ) : null}
              </Card>

              <TeamUsersPanel />
            </div>
          </div>

          {installGuideOpen ? (
            <InstallGuide context="tablet" onClose={() => setInstallGuideOpen(false)} />
          ) : null}

          {/* The demo shows the same rows a client sees, so nothing is hidden
              from a prospect. Both actions are stopped inside their handlers,
              before any mutation, rather than by removing the buttons. */}
          <DangerZone
            notice={
              <>
                {deletionRequestQuery.data?.paddle_cancellation_error ? (
                  <p className="text-destructive" role="alert">
                    Subscription cancellation will be retried automatically. You can also
                    check it now from Billing:{' '}
                    {deletionRequestQuery.data.paddle_cancellation_error}
                  </p>
                ) : null}
                {deletionMessage ? (
                  <p className="text-muted-foreground" role="status">
                    {deletionMessage}
                  </p>
                ) : null}
              </>
            }
            rows={[
              {
                id: 'download-organisation-data',
                label: 'Download all your data',
                description: 'Export every game, event, submission, payment record and uploaded file tied to this account.',
                action: (
                  <NeoButton type="button" variant="surface" disabled={exportingData} onClick={() => void handleDownloadData()}>
                    <IconDownload className="size-3.5" />
                    {exportingData ? 'Preparing…' : 'Download All Data'}
                  </NeoButton>
                ),
              },
              {
                id: 'delete-organisation',
                label: deletionRequestQuery.data
                  ? 'Deletion scheduled'
                  : 'Delete this account',
                description: deletionRequestQuery.data ? (
                  <>
                    Scheduled for permanent deletion on{' '}
                    <strong className="text-foreground">
                      {new Intl.DateTimeFormat('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }).format(new Date(deletionRequestQuery.data.scheduled_for))}
                    </strong>
                    . Until then all data remains available and you can restore it.
                  </>
                ) : (
                  'Your organisation stays restorable for 30 days. After that its events, games, submissions, uploaded media and user accounts are permanently removed.'
                ),
                action: deletionRequestQuery.data ? (
                  <NeoButton
                    type="button"
                    variant="surface"
                    disabled={cancelDeletion.isPending}
                    onClick={() => void handleCancelDeletion()}
                  >
                    {cancelDeletion.isPending ? 'Restoring…' : 'Restore account'}
                  </NeoButton>
                ) : (
                  <NeoButton
                    type="button"
                    variant="destructive"
                    disabled={requestDeletion.isPending || deletionRequestQuery.isLoading}
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    Delete
                  </NeoButton>
                ),
              },
            ]}
          />
        </div>
      )}

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

      {deleteConfirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-account-deletion-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <Card className="border-border/80 w-full max-w-md space-y-4 bg-card p-6 shadow-lg">
            <div className="space-y-2">
              <h2 id="request-account-deletion-title" className="text-foreground font-semibold">
                Request permanent account deletion?
              </h2>
              <p className="text-muted-foreground text-sm">
                Automatic subscription renewal will be canceled. You then have 30 days to
                restore the organization. After that, its Supabase data, uploaded media, and
                organization user accounts are permanently deleted.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <NeoButton
                type="button"
                variant="surface"
                disabled={requestDeletion.isPending}
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Cancel
              </NeoButton>
              <NeoButton
                type="button"
                variant="destructive"
                disabled={requestDeletion.isPending}
                onClick={() => void handleRequestDeletion()}
              >
                {requestDeletion.isPending ? 'Scheduling…' : 'Schedule deletion'}
              </NeoButton>
            </div>
          </Card>
        </div>
      ) : null}
    </AdminPageShell>
  )
}

/** My Account / Team switcher, platform owner only. */
function PlatformSettingsTabs({ active }: { active: 'account' | 'team' }) {
  return (
    <div
      className="border-border mb-6 flex items-center justify-center gap-6 border-b"
      role="tablist"
      aria-label="Settings sections"
    >
      {(
        [
          ['account', 'My Account', '/admin/settings?tab=account'],
          ['team', 'Team', '/admin/settings?tab=team'],
        ] as const
      ).map(([id, label, to]) => (
        <Link
          key={id}
          to={to}
          role="tab"
          aria-selected={active === id}
          className={
            active === id
              ? 'text-foreground after:bg-primary relative px-1 pb-3 text-sm font-semibold after:absolute after:inset-x-0 after:-bottom-px after:h-0.5'
              : 'text-muted-foreground hover:text-foreground relative px-1 pb-3 text-sm font-semibold transition-colors'
          }
        >
          {label}
        </Link>
      ))}
    </div>
  )
}
