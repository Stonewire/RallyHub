import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { DangerZone } from '@/components/admin/DangerZone'
import { useAuth } from '@/contexts/auth-context'
import { isPlatformOwner } from '@/lib/auth-routes'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { Card } from '@/components/ui/card'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import { PlanDetailsCard } from '@/components/billing/PlanDetailsCard'
import {
  ClientDetailTabs,
  normalizeClientDetailTab,
} from '@/components/rallyhub/ClientDetailTabs'
import { ClientEventsOverview } from '@/components/rallyhub/ClientEventsOverview'
import {
  NeoButton,
  NeoInput,
  NeoLabel,
  NeoTextarea,
  NeoStatusBadge,
} from '@/components/neo-minimal'
import {
  useCreateRallyHubClient,
  useDeleteRallyHubClient,
  useRallyHubClient,
  useUpdateClientAdmin,
  type ClientAdminUpdateInput,
} from '@/hooks/use-rallyhub'
import { downloadClientPackage } from '@/lib/client-export'
import { uploadOrganizationLogo, useOrganizationUsers } from '@/hooks/use-organization-settings'
import { useOrganizationDeletionRequest } from '@/hooks/use-data-lifecycle'
import {
  BILLING_PERIODS,
  formatBillingPeriodLabel,
  formatClientPlanLabel,
  getAdminAssignablePlans,
  getPlan,
  normalizeBillingPeriod,
  normalizeClientPlan,
} from '@/lib/client-plans'
import { normalizeEducationalStatus } from '@/lib/educational'
import { organizationInitials } from '@/lib/org-avatar'
import { getOrganizationOrigin } from '@/lib/tenant'
import { supabase } from '@/lib/supabase'

const STATUSES = ['active', 'suspended', 'trial'] as const

function clientEmail(org: { email: string | null; contact_email: string | null }) {
  return org.email?.trim() || org.contact_email?.trim() || ''
}

function resolveAdminLoginEmail(
  org: { email: string | null; contact_email: string | null },
  members: { email: string; role: string }[],
) {
  const adminMember = members.find(
    (m) => m.role === 'client_admin' || m.role === 'admin',
  )
  if (adminMember?.email?.trim()) return adminMember.email.trim()
  return clientEmail(org)
}

function loginPageRedirectUrl(org?: {
  subdomain: string
  custom_domain: string | null
}) {
  if (org?.subdomain?.trim()) {
    return `${getOrganizationOrigin(org)}/login`
  }
  return `${window.location.origin}/login`
}

async function sendPasswordResetEmail(emailAddress: string, redirectTo: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(emailAddress, {
    redirectTo,
  })
  if (error) throw new Error(error.message)
}

export function RallyHubClientDetailPage() {
  const { profile } = useAuth()
  const { clientId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isCreateMode = location.pathname.endsWith('/clients/new')
  const showBillingAndEvents = !isCreateMode
  const activeTab = normalizeClientDetailTab(
    searchParams.get('tab'),
    showBillingAndEvents,
  )

  const { data, isLoading, isError, error } = useRallyHubClient(
    isCreateMode ? undefined : clientId,
  )
  const createClient = useCreateRallyHubClient()
  const updateClient = useUpdateClientAdmin()
  const fileRef = useRef<HTMLInputElement>(null)

  const [orgName, setOrgName] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [notes, setNotes] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [billingPlan, setBillingPlan] = useState('rookie')
  const [billingPeriod, setBillingPeriod] = useState('monthly')
  const [accountStatus, setAccountStatus] = useState('active')
  const [trialEndsAt, setTrialEndsAt] = useState<string>('')
  const [trialReviewNeeded, setTrialReviewNeeded] = useState(false)
  const [hidePlatformBranding, setHidePlatformBranding] = useState(false)
  const [educationalStatus, setEducationalStatus] = useState('none')
  const [vatNumber, setVatNumber] = useState('')
  const [addressStreet, setAddressStreet] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [addressState, setAddressState] = useState('')
  const [addressPostal, setAddressPostal] = useState('')
  const [addressCountry, setAddressCountry] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const orgUsersQuery = useOrganizationUsers(isCreateMode ? null : (clientId ?? null))
  const [adminResetMessage, setAdminResetMessage] = useState<string | null>(null)
  const [adminResetError, setAdminResetError] = useState<string | null>(null)
  const [adminResetSending, setAdminResetSending] = useState(false)
  const [adminResetConfirmEmail, setAdminResetConfirmEmail] = useState<string | null>(null)
  const deleteClient = useDeleteRallyHubClient()
  const deletionRequestQuery = useOrganizationDeletionRequest(
    isCreateMode ? null : (clientId ?? null),
  )
  const [downloading, setDownloading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [dangerError, setDangerError] = useState<string | null>(null)

  async function handleDownloadData() {
    if (!clientId) return
    setDangerError(null)
    setDownloading(true)
    try {
      await downloadClientPackage(clientId)
    } catch (err) {
      setDangerError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  async function handleDeleteClient() {
    if (!clientId) return
    setDangerError(null)
    try {
      await deleteClient.mutateAsync(clientId)
      navigate('/admin/clients', { replace: true })
    } catch (err) {
      setDangerError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  useEffect(() => {
    if (!data?.org) return
    const org = data.org
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrates the local editable form from fetched data
    setOrgName(org.name)
    setNotes(org.internal_notes ?? '')
    setSubdomain(org.subdomain ?? '')
    setEmail(clientEmail(org))
    setPhone(org.phone ?? '')
    setBillingPlan(normalizeClientPlan(org.billing_plan))
    setBillingPeriod(normalizeBillingPeriod(org.billing_period))
    setAccountStatus(org.account_status ?? 'active')
    setTrialEndsAt(org.trial_ends_at ? org.trial_ends_at.slice(0, 10) : '')
    setTrialReviewNeeded(org.trial_review_needed ?? false)
    setHidePlatformBranding(org.hide_platform_branding ?? false)
    setEducationalStatus(normalizeEducationalStatus(org.educational_status))
    setVatNumber(org.vat_number ?? '')
    setAddressStreet(org.address_street ?? org.address ?? '')
    setAddressCity(org.address_city ?? '')
    setAddressState(org.address_state ?? '')
    setAddressPostal(org.address_postal ?? '')
    setAddressCountry(org.address_country ?? '')
    setLogoUrl(org.logo_url)
    setLogoFile(null)
    setLogoPreview(null)
  }, [data?.org])

  useEffect(() => {
    if (!logoFile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing the preview when the file is removed
      setLogoPreview(null)
      return
    }
    const url = URL.createObjectURL(logoFile)
    setLogoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [logoFile])

  function setTab(tab: 'info' | 'billing' | 'events') {
    if (tab === 'info') {
      setSearchParams({})
      return
    }
    setSearchParams({ tab })
  }

  async function handleAdminPasswordReset() {
    if (!data?.org) return
    const adminLoginEmail = resolveAdminLoginEmail(data.org, data.members)
    if (!adminLoginEmail) {
      setAdminResetError('No admin login email is on file for this client.')
      setAdminResetMessage(null)
      return
    }

    setAdminResetConfirmEmail(adminLoginEmail)
  }

  async function confirmAdminPasswordReset() {
    if (!adminResetConfirmEmail) return
    const email = adminResetConfirmEmail
    setAdminResetConfirmEmail(null)
    setAdminResetSending(true)
    setAdminResetError(null)
    setAdminResetMessage(null)
    try {
      await sendPasswordResetEmail(email, loginPageRedirectUrl(data?.org))
      setAdminResetMessage(`Password reset email sent to ${email}`)
    } catch (err) {
      setAdminResetError(
        err instanceof Error ? err.message : 'Failed to send password reset email',
      )
    } finally {
      setAdminResetSending(false)
    }
  }

  async function handleLogoChange(file: File | undefined) {
    if (!file) return
    if (isCreateMode) {
      setLogoFile(file)
      return
    }
    if (!clientId) return
    setLogoUploading(true)
    setSaveError(null)
    try {
      const url = await uploadOrganizationLogo(clientId, file)
      setLogoUrl(url)
      setLogoFile(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Logo upload failed')
    } finally {
      setLogoUploading(false)
    }
  }

  function buildUpdatePayload(orgId: string, logo?: string | null): ClientAdminUpdateInput {
    return {
      orgId,
      name: orgName.trim(),
      notes,
      subdomain,
      email,
      phone,
      billing_plan: billingPlan,
      billing_period: billingPeriod,
      account_status: accountStatus,
      trial_ends_at: trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
      trial_review_needed: trialReviewNeeded,
      hide_platform_branding: hidePlatformBranding,
      educational_status: educationalStatus,
      logo_url: logo !== undefined ? logo : logoUrl,
      vat_number: vatNumber,
      address_street: addressStreet,
      address_city: addressCity,
      address_state: addressState,
      address_postal: addressPostal,
      address_country: addressCountry,
    }
  }

  async function handleSave() {
    setSaveError(null)
    setSaveSuccess(false)
    try {
      if (isCreateMode) {
        if (!orgName.trim()) throw new Error('Organization name is required.')
        if (!loginEmail.trim()) throw new Error('Admin login email is required.')
        if (!loginPassword) throw new Error('Admin login password is required.')

        const org = await createClient.mutateAsync({
          name: orgName.trim(),
          email: loginEmail.trim(),
          password: loginPassword,
          subdomain: subdomain.trim() || undefined,
          billing_plan: billingPlan,
          billing_period: billingPeriod,
        })

        let finalLogoUrl = logoUrl
        if (logoFile) {
          finalLogoUrl = await uploadOrganizationLogo(org.id, logoFile)
        }

        await updateClient.mutateAsync(buildUpdatePayload(org.id, finalLogoUrl))
        navigate(`/admin/clients/${org.id}`, { replace: true })
        return
      }

      if (!clientId) return
      await updateClient.mutateAsync(buildUpdatePayload(clientId))
      setSaveSuccess(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save client')
    }
  }

  if (!isCreateMode && isLoading) {
    return (
      <AdminPageShell title="Client" backTo="/admin/clients" backLabel="Back to clients">
        <QueryLoading rows={4} />
      </AdminPageShell>
    )
  }

  if (!isCreateMode && (isError || !data)) {
    return (
      <AdminPageShell title="Client" backTo="/admin/clients" backLabel="Back to clients">
        <QueryError message={error?.message ?? 'Not found'} />
      </AdminPageShell>
    )
  }

  const org = data?.org
  const tenantUrl = isCreateMode
    ? subdomain.trim()
      ? getOrganizationOrigin({ subdomain: subdomain.trim().toLowerCase(), custom_domain: null })
      : 'Set a subdomain to preview the tenant URL'
    : getOrganizationOrigin({
        subdomain: org!.subdomain,
        custom_domain: org!.custom_domain,
      })
  const displayName = orgName.trim() || (isCreateMode ? 'New client' : org!.name)
  const isDemoClient = org?.is_demo === true
  const ownerHere = isPlatformOwner(profile?.staff_role)
  const initials = organizationInitials(displayName)
  const contactEmail = email.trim() || (org ? clientEmail(org) : '')
  const displayLogo = logoPreview || logoUrl
  const saving = createClient.isPending || updateClient.isPending || logoUploading

  const clientInfoTab = (
    <div className="space-y-4">
      {/* Two-column mirror of the client's own Organisation tab, so a super
          admin sees the same screen the client manages, with the RallyHub-only
          controls folded into the right column. */}
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card className="border-border/80 space-y-4 bg-card p-4 shadow-sm">
            <ClientCardHeader title="Brand Identity" visibility="Public" />
            <div className="space-y-1.5">
              <NeoLabel htmlFor="org-name">Organisation Name</NeoLabel>
              <NeoInput
                id="org-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="bg-background"
                placeholder="Acme Events"
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleLogoChange(e.target.files?.[0])}
            />
            {/* The client page's dashed logo target, click-to-upload. */}
            <button
              type="button"
              disabled={logoUploading || saving}
              onClick={() => fileRef.current?.click()}
              className="text-muted-foreground border-border hover:border-nm-slate-400 hover:bg-muted/20 flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-md border-[1.5px] border-dashed px-4 py-5 text-center text-xs transition-colors"
            >
              {displayLogo ? (
                <img src={displayLogo} alt="" className="max-h-16 max-w-40 object-contain" />
              ) : (
                <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-lg text-lg font-semibold">
                  {initials}
                </div>
              )}
              <span>
                {logoUploading
                  ? 'Uploading…'
                  : displayLogo
                    ? 'Click to replace their logo'
                    : 'Click to upload their logo'}
              </span>
            </button>
            <div className="flex flex-wrap items-center gap-2">
              {isDemoClient ? (
                <NeoStatusBadge tone="demo">Demo</NeoStatusBadge>
              ) : accountStatus === 'active' ? (
                <NeoStatusBadge tone="active">Active</NeoStatusBadge>
              ) : accountStatus === 'trial' ? (
                <NeoStatusBadge tone="ready">Trial</NeoStatusBadge>
              ) : (
                <NeoStatusBadge tone="archived">{accountStatus}</NeoStatusBadge>
              )}
              <span className="text-muted-foreground text-xs">
                {isDemoClient
                  ? 'Demo account · no billing'
                  : `${formatClientPlanLabel(billingPlan)} · ${formatBillingPeriodLabel(
                      normalizeBillingPeriod(billingPeriod),
                    )}`}
              </span>
            </div>
          </Card>

          <Card className="border-border/80 space-y-4 bg-card p-4 shadow-sm">
            <ClientCardHeader title="Legal & Billing Details" visibility="Private" />
            <div className="space-y-1.5">
              <NeoLabel htmlFor="vat">Tax / VAT ID</NeoLabel>
              <NeoInput
                id="vat"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                className="bg-background"
                placeholder="MT12341234"
              />
            </div>
            <div className="space-y-1.5">
              <NeoLabel htmlFor="address-street">Street</NeoLabel>
              <NeoInput
                id="address-street"
                value={addressStreet}
                onChange={(e) => setAddressStreet(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <NeoLabel htmlFor="address-city">City</NeoLabel>
                <NeoInput
                  id="address-city"
                  value={addressCity}
                  onChange={(e) => setAddressCity(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <NeoLabel htmlFor="address-country">Country</NeoLabel>
                <NeoInput
                  id="address-country"
                  value={addressCountry}
                  onChange={(e) => setAddressCountry(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <NeoLabel htmlFor="address-state">State or Region</NeoLabel>
                <NeoInput
                  id="address-state"
                  value={addressState}
                  onChange={(e) => setAddressState(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <NeoLabel htmlFor="address-postal">Post Code</NeoLabel>
                <NeoInput
                  id="address-postal"
                  value={addressPostal}
                  onChange={(e) => setAddressPostal(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>
          </Card>

          <Card className="border-border/80 space-y-3 bg-card p-4 shadow-sm">
            <ClientCardHeader title="Internal Notes" visibility="RallyHub" />
            <NeoTextarea
              id="internal-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 text-sm"
              placeholder="Only RallyHub staff see these."
            />
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="border-border/80 space-y-4 bg-card p-4 shadow-sm">
            <ClientCardHeader title="Plan & Account" visibility="RallyHub" />
            {!ownerHere ? (
              <p className="text-muted-foreground text-sm">
                Plan, account status and the watermark toggle are owner-only. This account is
                on {formatClientPlanLabel(billingPlan)} (
                {formatBillingPeriodLabel(normalizeBillingPeriod(billingPeriod))}), status{' '}
                {accountStatus}.
              </p>
            ) : null}
            {isDemoClient ? (
              <p className="text-muted-foreground text-sm">
                This organisation runs the public demo. Nothing here is charged, and it is
                excluded from Payments and platform revenue.
              </p>
            ) : null}
            {ownerHere ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <NeoLabel htmlFor="billing-plan">Billing plan</NeoLabel>
                <select
                  id="billing-plan"
                  value={billingPlan}
                  onChange={(e) => setBillingPlan(e.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                >
                  {getAdminAssignablePlans().map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                      {plan.hidden ? ' (hidden)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <NeoLabel htmlFor="billing-period">Billing period</NeoLabel>
                <select
                  id="billing-period"
                  value={billingPeriod}
                  onChange={(e) => setBillingPeriod(e.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                >
                  {BILLING_PERIODS.map((period) => (
                    <option key={period} value={period}>
                      {formatBillingPeriodLabel(period)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <NeoLabel htmlFor="account-status">Account status</NeoLabel>
                <select
                  id="account-status"
                  value={accountStatus}
                  onChange={(e) => {
                    setAccountStatus(e.target.value)
                    if (e.target.value !== 'trial') setTrialEndsAt('')
                  }}
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <NeoLabel htmlFor="educational-status">Educational (school)</NeoLabel>
                <select
                  id="educational-status"
                  value={educationalStatus}
                  onChange={(e) => setEducationalStatus(e.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                >
                  <option value="none">Not educational</option>
                  <option value="pending">Pending review (requested)</option>
                  <option value="approved">Approved — 50% off subscriptions & events</option>
                </select>
              </div>
              {accountStatus === 'trial' ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <NeoLabel htmlFor="trial-ends-at">Trial end date</NeoLabel>
                  <NeoInput
                    id="trial-ends-at"
                    type="date"
                    value={trialEndsAt}
                    onChange={(e) => setTrialEndsAt(e.target.value)}
                    className="bg-background max-w-xs"
                  />
                  <p className="text-muted-foreground text-xs">
                    When this date passes, the account is suspended automatically and flagged
                    for review.
                  </p>
                </div>
              ) : null}
            </div>
            ) : null}
            {ownerHere && educationalStatus === 'pending' ? (
              <p className="text-muted-foreground text-xs">
                This account requested educational pricing at signup. Set to "Approved" once
                verified to apply the 50% discount.
              </p>
            ) : null}
            {ownerHere && trialReviewNeeded ? (
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm">
                <p className="font-medium text-orange-800">Trial expired — review needed</p>
                <p className="mt-0.5 text-xs text-orange-700">
                  This account was suspended automatically when its trial ended.
                </p>
                <button
                  type="button"
                  className="mt-1 text-xs text-orange-800 underline"
                  onClick={() => setTrialReviewNeeded(false)}
                >
                  Mark as reviewed (clears flag on save)
                </button>
              </div>
            ) : null}
            {isDemoClient ? null : (
              <PlanDetailsCard planId={billingPlan} billingPeriod={billingPeriod} compact />
            )}
            {getPlan(billingPlan).hidden ? (
              <p className="text-muted-foreground text-xs">
                Partner is a fully comped plan and is not shown to clients in public plan
                lists.
              </p>
            ) : null}
            {ownerHere ? (
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={hidePlatformBranding}
                onChange={(e) => setHidePlatformBranding(e.target.checked)}
                className="accent-primary size-4 rounded"
              />
              <span className="text-sm">
                Hide "Powered by RallyHub" watermark on live event surfaces
                <span className="text-muted-foreground ml-1 text-xs">(Max / Partner)</span>
              </span>
            </label>
            ) : null}
          </Card>

          <Card className="border-border/80 space-y-4 bg-card p-4 shadow-sm">
            <ClientCardHeader title="Contact & Tenant" visibility="Private" />
            <div>
              <NeoLabel htmlFor="tenant-url">Tenant URL</NeoLabel>
              <p id="tenant-url" className="text-foreground mt-1 font-mono text-sm">
                {tenantUrl}
              </p>
            </div>
            <div className="space-y-1.5">
              <NeoLabel htmlFor="subdomain">Subdomain</NeoLabel>
              <NeoInput
                id="subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                className="bg-background max-w-xs font-mono"
                placeholder="afterglow"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <NeoLabel htmlFor="client-email">Contact email</NeoLabel>
                <NeoInput
                  id="client-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background"
                  placeholder="contact@company.com"
                />
              </div>
              <div className="space-y-1.5">
                <NeoLabel htmlFor="client-phone">Phone</NeoLabel>
                <NeoInput
                  id="client-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-background"
                  placeholder="+1 555 0100"
                />
              </div>
            </div>
            {contactEmail ? (
              <NeoButton variant="surface" size="sm" asChild>
                <a href={`mailto:${encodeURIComponent(contactEmail)}`}>Contact client</a>
              </NeoButton>
            ) : (
              <p className="text-muted-foreground text-xs">
                Add a contact email and save to enable contact.
              </p>
            )}
          </Card>

          {isCreateMode ? (
            <Card className="border-border/80 space-y-4 bg-card p-4 shadow-sm">
              <ClientCardHeader title="Admin Login" visibility="Private" />
              <p className="text-muted-foreground text-sm">
                Creates the client's first admin user account.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <NeoLabel htmlFor="login-email">Admin login email</NeoLabel>
                  <NeoInput
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="bg-background"
                    placeholder="admin@company.com"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <NeoLabel htmlFor="login-password">Admin login password</NeoLabel>
                  <NeoInput
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="bg-background"
                    placeholder="Temporary password"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </Card>
          ) : data ? (
            <Card className="border-border/80 space-y-4 bg-card p-4 shadow-sm">
              <ClientCardHeader title="Admin Login & Team" visibility="Private" />
              <div className="space-y-1.5">
                <NeoLabel htmlFor="admin-login-email-display">Admin login email</NeoLabel>
                <p
                  id="admin-login-email-display"
                  className="text-foreground bg-muted/30 rounded-lg px-3 py-2 text-sm"
                >
                  {resolveAdminLoginEmail(data.org, data.members) || '—'}
                </p>
              </div>
              {adminResetError ? <QueryError message={adminResetError} /> : null}
              {adminResetMessage ? (
                <p className="text-foreground text-sm" role="status">
                  {adminResetMessage}
                </p>
              ) : null}
              <NeoButton
                type="button"
                variant="surface"
                size="sm"
                disabled={
                  adminResetSending || !resolveAdminLoginEmail(data.org, data.members)
                }
                onClick={() => void handleAdminPasswordReset()}
              >
                {adminResetSending ? 'Sending…' : 'Send Password Reset'}
              </NeoButton>
              <div className="border-border/70 border-t pt-3">
                <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
                  Team members
                </p>
                {orgUsersQuery.isLoading ? (
                  <p className="text-muted-foreground text-sm">Loading users…</p>
                ) : (orgUsersQuery.data?.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground text-sm">No users yet.</p>
                ) : (
                  <ul className="divide-border divide-y">
                    {orgUsersQuery.data?.map((u) => {
                      const memberName =
                        [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username
                      return (
                        <li
                          key={u.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-foreground truncate text-sm font-medium">
                              {memberName}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {u.email} · {u.role.replace(/_/g, ' ')}
                            </p>
                          </div>
                          <NeoButton
                            type="button"
                            size="sm"
                            variant="surface"
                            onClick={() => setAdminResetConfirmEmail(u.email)}
                          >
                            Reset password
                          </NeoButton>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      {!isCreateMode && clientId && ownerHere ? (
        // The shared Danger Zone, so this reads the same as Organisation,
        // My Account and the event editor. Deleting a client is owner-only,
        // enforced again in the data-lifecycle function.
        <DangerZone
          notice={
            <>
              {deletionRequestQuery.data ? (
                <p className="text-destructive text-sm font-medium">
                  The client requested account deletion. Automatic cleanup is scheduled for{' '}
                  {new Intl.DateTimeFormat('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(deletionRequestQuery.data.scheduled_for))}.
                </p>
              ) : null}
              {dangerError ? <QueryError message={dangerError} /> : null}
            </>
          }
          rows={[
            {
              id: 'download-client-data',
              label: 'Download client data',
              description:
                'A full export of the organisation, its events, teams, submissions and media. Take one before deleting.',
              action: (
                <NeoButton
                  variant="surface"
                  disabled={downloading}
                  onClick={() => void handleDownloadData()}
                >
                  {downloading ? 'Preparing…' : 'Download'}
                </NeoButton>
              ),
            },
            {
              id: 'delete-client',
              label: 'Delete this client',
              description:
                'Permanently removes the organisation, its events, teams, submissions, media and user accounts. This cannot be undone.',
              action: (
                <NeoButton
                  variant="destructive"
                  disabled={deleteClient.isPending}
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete
                </NeoButton>
              ),
            },
          ]}
        />
      ) : null}
    </div>
  )

  return (
    <AdminPageShell
      title={displayName}
      subtitle={
        isCreateMode
          ? 'Create a new client organization and admin account.'
          : 'Client organization details.'
      }
      backTo="/admin/clients"
      backLabel="Back to clients"
    >
      {saveError ? <QueryError message={saveError} /> : null}
      {saveSuccess ? (
        <p className="text-muted-foreground mb-4 text-sm">Client saved.</p>
      ) : null}

      <ClientDetailTabs
        activeTab={activeTab}
        onTabChange={setTab}
        showBillingAndEvents={showBillingAndEvents}
      />

      {activeTab === 'info' ? clientInfoTab : null}

      {activeTab === 'events' && showBillingAndEvents && data ? (
        <ClientEventsOverview
          events={data.events}
          clientPlan={billingPlan}
          hideInvoiceState={isDemoClient}
          clientId={clientId}
        />
      ) : null}

      {activeTab === 'info' ? (
        <FormSaveFooter
          label={isCreateMode ? 'Create client' : 'Save client'}
          saving={saving}
          onSave={() => void handleSave()}
        />
      ) : null}

      {adminResetConfirmEmail ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-reset-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        >
          <div className="bg-card border-border/80 w-full max-w-sm rounded-xl border p-6 shadow-lg">
            <h2 id="admin-reset-title" className="text-foreground mb-2 font-semibold">Send password reset?</h2>
            <p className="text-muted-foreground mb-5 text-sm">
              A secure reset link will be sent to <strong className="text-foreground">{adminResetConfirmEmail}</strong>.
            </p>
            <div className="flex justify-end gap-2">
              <NeoButton variant="surface" size="sm" onClick={() => setAdminResetConfirmEmail(null)}>Cancel</NeoButton>
              <NeoButton size="sm" onClick={() => void confirmAdminPasswordReset()}>Send</NeoButton>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      {deleteOpen ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-client-title"
          className="neo-minimal-scope fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        >
          <div className="bg-card border-border/80 w-full max-w-sm rounded-xl border p-6 shadow-lg">
            <h2 id="delete-client-title" className="text-foreground mb-2 font-semibold">
              Delete this client?
            </h2>
            <p className="text-muted-foreground mb-5 text-sm">
              This permanently removes <strong className="text-foreground">{displayName}</strong>{' '}
              and all its events, teams, submissions, media, and user accounts from Supabase.
              This cannot be undone. Make sure you have downloaded the data first.
            </p>
            <div className="flex justify-end gap-2">
              <NeoButton
                variant="surface"
                size="sm"
                disabled={deleteClient.isPending}
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </NeoButton>
              <NeoButton
                variant="destructive"
                size="sm"
                disabled={deleteClient.isPending}
                onClick={() => void handleDeleteClient()}
              >
                {deleteClient.isPending ? 'Deleting…' : 'Delete permanently'}
              </NeoButton>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </AdminPageShell>
  )
}

/**
 * The client Organisation tab's card header: title plus a visibility chip.
 * Red warns the fields are public, green says the client keeps them private,
 * and the neutral RallyHub chip marks controls the client never sees at all.
 */
function ClientCardHeader({
  title,
  visibility,
}: {
  title: string
  visibility: 'Public' | 'Private' | 'RallyHub'
}) {
  const chip =
    visibility === 'Public'
      ? 'bg-[#f6dede] text-[#8a2b2b] dark:bg-[#4a2020] dark:text-[#f0b9b9]'
      : visibility === 'Private'
        ? 'bg-[#d9efe3] text-[#1f6b48] dark:bg-[#1d3d2d] dark:text-[#a6dcc0]'
        : 'bg-muted text-muted-foreground'
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-foreground text-sm font-bold">{title}</h2>
      <span className={`rounded px-2 py-1 text-[10px] font-semibold ${chip}`}>
        {visibility === 'RallyHub' ? 'RallyHub only' : visibility}
      </span>
    </div>
  )
}
