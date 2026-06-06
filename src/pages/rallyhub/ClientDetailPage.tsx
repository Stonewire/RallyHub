import { Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import { BillingOverview } from '@/components/billing/BillingOverview'
import { PlanDetailsCard } from '@/components/billing/PlanDetailsCard'
import {
  ClientDetailTabs,
  normalizeClientDetailTab,
} from '@/components/rallyhub/ClientDetailTabs'
import { ClientEventsOverview } from '@/components/rallyhub/ClientEventsOverview'
import {
  NeoButton,
  NeoCard,
  NeoInput,
  NeoLabel,
  NeoPageShell,
  NeoTextarea,
} from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import {
  useCreateRallyHubClient,
  useRallyHubClient,
  useUpdateClientAdmin,
  type ClientAdminUpdateInput,
} from '@/hooks/use-rallyhub'
import { uploadOrganizationLogo } from '@/hooks/use-organization-settings'
import {
  BILLING_PERIODS,
  formatBillingPeriodLabel,
  formatClientPlanLabel,
  getAdminAssignablePlans,
  getPlan,
  normalizeBillingPeriod,
  normalizeClientPlan,
} from '@/lib/client-plans'
import { countClientEvents } from '@/lib/client-events'
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
  const [billingPlan, setBillingPlan] = useState('free')
  const [billingPeriod, setBillingPeriod] = useState('monthly')
  const [accountStatus, setAccountStatus] = useState('active')
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
  const [memberResetEmail, setMemberResetEmail] = useState<Record<string, string>>({})
  const [adminResetMessage, setAdminResetMessage] = useState<string | null>(null)
  const [adminResetError, setAdminResetError] = useState<string | null>(null)
  const [adminResetSending, setAdminResetSending] = useState(false)

  useEffect(() => {
    if (!data?.org) return
    const org = data.org
    setOrgName(org.name)
    setNotes(org.internal_notes ?? '')
    setSubdomain(org.subdomain ?? '')
    setEmail(clientEmail(org))
    setPhone(org.phone ?? '')
    setBillingPlan(normalizeClientPlan(org.billing_plan))
    setBillingPeriod(normalizeBillingPeriod(org.billing_period))
    setAccountStatus(org.account_status ?? 'active')
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

  async function sendMemberPasswordReset(emailAddress: string) {
    const redirectTo = data?.org
      ? loginPageRedirectUrl(data.org)
      : loginPageRedirectUrl(
          subdomain.trim()
            ? { subdomain: subdomain.trim().toLowerCase(), custom_domain: null }
            : undefined,
        )
    await sendPasswordResetEmail(emailAddress, redirectTo)
  }

  async function handleAdminPasswordReset() {
    if (!data?.org) return
    const adminLoginEmail = resolveAdminLoginEmail(data.org, data.members)
    if (!adminLoginEmail) {
      setAdminResetError('No admin login email is on file for this client.')
      setAdminResetMessage(null)
      return
    }

    const confirmed = window.confirm(
      `Send a password reset email to ${adminLoginEmail}? The client will receive a secure link to set a new password.`,
    )
    if (!confirmed) return

    setAdminResetSending(true)
    setAdminResetError(null)
    setAdminResetMessage(null)
    try {
      await sendPasswordResetEmail(adminLoginEmail, loginPageRedirectUrl(data.org))
      setAdminResetMessage(`Password reset email sent to ${adminLoginEmail}`)
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
      <NeoPageShell title="Client" backTo="/admin/clients" backLabel="Back to clients">
        <QueryLoading rows={4} />
      </NeoPageShell>
    )
  }

  if (!isCreateMode && (isError || !data)) {
    return (
      <NeoPageShell title="Client" backTo="/admin/clients" backLabel="Back to clients">
        <QueryError message={error?.message ?? 'Not found'} />
      </NeoPageShell>
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
  const eventCounts = data ? countClientEvents(data.events) : null
  const displayName = orgName.trim() || (isCreateMode ? 'New client' : org!.name)
  const initials = organizationInitials(displayName)
  const contactEmail = email.trim() || (org ? clientEmail(org) : '')
  const displayLogo = logoPreview || logoUrl
  const saving = createClient.isPending || updateClient.isPending || logoUploading

  const clientInfoTab = (
    <div className="space-y-6">
      <NeoCard className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-5">
          <div className="space-y-3">
            {displayLogo ? (
              <img
                src={displayLogo}
                alt=""
                className="border-border/80 size-16 shrink-0 rounded-lg border object-contain"
              />
            ) : (
              <div className="bg-muted text-muted-foreground flex size-16 shrink-0 items-center justify-center rounded-lg text-lg font-semibold">
                {initials}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleLogoChange(e.target.files?.[0])}
            />
            <NeoButton
              type="button"
              variant="surface"
              size="sm"
              disabled={saving}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" />
              {logoUploading ? 'Uploading…' : 'Upload logo'}
            </NeoButton>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-2">
              <NeoLabel htmlFor="org-name">Organization name</NeoLabel>
              <NeoInput
                id="org-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="bg-background"
                placeholder="Acme Events"
              />
            </div>
            <p className="text-muted-foreground text-sm">
              Plan: {formatClientPlanLabel(billingPlan)} (
              {formatBillingPeriodLabel(normalizeBillingPeriod(billingPeriod))})
            </p>
            <p className="text-muted-foreground text-sm capitalize">
              Status: {accountStatus}
            </p>
          </div>
        </div>

        {!isCreateMode && eventCounts ? (
          <div className="border-border/80 grid gap-4 border-t pt-4 sm:grid-cols-2">
            <div className="bg-muted/30 rounded-lg px-3 py-2">
              <p className="text-foreground text-xl font-semibold tabular-nums">
                {eventCounts.completedEvents}
              </p>
              <p className="text-muted-foreground text-sm">Completed events</p>
            </div>
            <div className="bg-muted/30 rounded-lg px-3 py-2">
              <p className="text-foreground text-xl font-semibold tabular-nums">
                {eventCounts.upcomingEvents}
              </p>
              <p className="text-muted-foreground text-sm">Upcoming events</p>
            </div>
          </div>
        ) : null}
      </NeoCard>

      {isCreateMode ? (
        <NeoCard className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
          <h3 className="text-foreground font-semibold">Admin login</h3>
          <p className="text-muted-foreground text-sm">
            Creates the client&apos;s first admin user account.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
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
            <div className="space-y-2">
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
        </NeoCard>
      ) : data ? (
        <NeoCard className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
          <h3 className="text-foreground font-semibold">Admin login</h3>
          <p className="text-muted-foreground text-sm">
            The email address the client uses to sign in to their admin account.
          </p>
          <div className="space-y-2">
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
          <Button
            type="button"
            variant="outline"
            disabled={
              adminResetSending || !resolveAdminLoginEmail(data.org, data.members)
            }
            onClick={() => void handleAdminPasswordReset()}
          >
            {adminResetSending ? 'Sending…' : 'Send Password Reset'}
          </Button>
        </NeoCard>
      ) : null}

      <NeoCard className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
        <h3 className="text-foreground font-semibold">Contact &amp; plan</h3>
        <div>
          <NeoLabel htmlFor="tenant-url">Tenant URL</NeoLabel>
          <p id="tenant-url" className="text-foreground mt-1 font-mono text-sm">
            {tenantUrl}
          </p>
        </div>
        <div className="space-y-2">
          <NeoLabel htmlFor="subdomain">Subdomain</NeoLabel>
          <NeoInput
            id="subdomain"
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value)}
            className="bg-background max-w-xs font-mono"
            placeholder="afterglow"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
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
          <div className="space-y-2">
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
          <Button variant="outline" size="sm" asChild>
            <a href={`mailto:${encodeURIComponent(contactEmail)}`}>Contact client</a>
          </Button>
        ) : (
          <p className="text-muted-foreground text-xs">
            Add a contact email and save to enable contact.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <NeoLabel htmlFor="billing-plan">Billing plan</NeoLabel>
            <select
              id="billing-plan"
              value={billingPlan}
              onChange={(e) => setBillingPlan(e.target.value)}
              className="neo-field w-full px-3 py-2 text-sm"
            >
              {getAdminAssignablePlans().map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                  {plan.hidden ? ' (hidden)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <NeoLabel htmlFor="billing-period">Billing period</NeoLabel>
            <select
              id="billing-period"
              value={billingPeriod}
              onChange={(e) => setBillingPeriod(e.target.value)}
              className="neo-field w-full px-3 py-2 text-sm"
            >
              {BILLING_PERIODS.map((period) => (
                <option key={period} value={period}>
                  {formatBillingPeriodLabel(period)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <NeoLabel htmlFor="account-status">Account status</NeoLabel>
            <select
              id="account-status"
              value={accountStatus}
              onChange={(e) => setAccountStatus(e.target.value)}
              className="neo-field w-full px-3 py-2 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <PlanDetailsCard planId={billingPlan} billingPeriod={billingPeriod} compact />
        {getPlan(billingPlan).hidden ? (
          <p className="text-muted-foreground text-xs">
            Partner is a fully comped plan and is not shown to clients in public plan
            lists.
          </p>
        ) : null}
      </NeoCard>

      <NeoCard className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
        <h3 className="text-foreground text-lg font-semibold">Company details</h3>
        <div className="space-y-2">
          <NeoLabel htmlFor="vat">VAT number</NeoLabel>
          <NeoInput
            id="vat"
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <NeoLabel htmlFor="address-street">Street</NeoLabel>
          <NeoInput
            id="address-street"
            value={addressStreet}
            onChange={(e) => setAddressStreet(e.target.value)}
            className="bg-background"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <NeoLabel htmlFor="address-city">City</NeoLabel>
            <NeoInput
              id="address-city"
              value={addressCity}
              onChange={(e) => setAddressCity(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <NeoLabel htmlFor="address-state">State / region</NeoLabel>
            <NeoInput
              id="address-state"
              value={addressState}
              onChange={(e) => setAddressState(e.target.value)}
              className="bg-background"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <NeoLabel htmlFor="address-postal">Postal code</NeoLabel>
            <NeoInput
              id="address-postal"
              value={addressPostal}
              onChange={(e) => setAddressPostal(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <NeoLabel htmlFor="address-country">Country</NeoLabel>
            <NeoInput
              id="address-country"
              value={addressCountry}
              onChange={(e) => setAddressCountry(e.target.value)}
              className="bg-background"
            />
          </div>
        </div>
      </NeoCard>

      {!isCreateMode && data ? (
        <NeoCard className="border-border/80 bg-card p-6 shadow-sm">
          <h3 className="text-foreground mb-4 font-semibold">Team members</h3>
          <ul className="space-y-3">
            {data.profiles.map((p) => (
              <li
                key={p.id}
                className="border-border/80 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{p.full_name || p.id}</p>
                  <p className="text-muted-foreground text-xs capitalize">{p.role}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <NeoInput
                    type="email"
                    value={memberResetEmail[p.id] ?? ''}
                    onChange={(e) =>
                      setMemberResetEmail((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                    placeholder="User email"
                    className="bg-background h-8 max-w-[14rem] text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!memberResetEmail[p.id]?.trim()}
                    onClick={() => {
                      const addr = memberResetEmail[p.id]?.trim()
                      if (addr) void sendMemberPasswordReset(addr)
                    }}
                  >
                    Send reset email
                  </Button>
                </div>
              </li>
            ))}
            {data.members.map((m) => (
              <li key={m.id} className="text-muted-foreground text-sm">
                {m.email} (invited)
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="ml-2"
                  onClick={() => void sendMemberPasswordReset(m.email)}
                >
                  Send reset email
                </Button>
              </li>
            ))}
          </ul>
        </NeoCard>
      ) : null}

      <NeoCard className="border-border/80 space-y-3 bg-card p-6 shadow-sm">
        <NeoLabel htmlFor="internal-notes">Internal notes</NeoLabel>
        <NeoTextarea
          id="internal-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 text-sm"
        />
      </NeoCard>
    </div>
  )

  return (
    <NeoPageShell
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

      {activeTab === 'billing' && showBillingAndEvents && data && clientId ? (
        <BillingOverview
          organizationId={clientId}
          billingPlan={billingPlan}
          billingPeriod={billingPeriod}
          showAdminSummary
        />
      ) : null}

      {activeTab === 'events' && showBillingAndEvents && data ? (
        <ClientEventsOverview events={data.events} clientPlan={billingPlan} />
      ) : null}

      {activeTab === 'info' ? (
        <FormSaveFooter
          label={isCreateMode ? 'Create client' : 'Save client'}
          saving={saving}
          onSave={() => void handleSave()}
        />
      ) : null}
    </NeoPageShell>
  )
}
