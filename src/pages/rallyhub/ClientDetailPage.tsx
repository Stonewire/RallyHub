import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRallyHubClient, useUpdateClientAdmin } from '@/hooks/use-rallyhub'
import {
  CLIENT_PLAN_OPTIONS,
  formatClientPlanLabel,
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

export function RallyHubClientDetailPage() {
  const { clientId } = useParams()
  const { data, isLoading, isError, error } = useRallyHubClient(clientId)
  const updateClient = useUpdateClientAdmin()
  const [notes, setNotes] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [billingPlan, setBillingPlan] = useState('free')
  const [accountStatus, setAccountStatus] = useState('active')

  useEffect(() => {
    if (data?.org) {
      setNotes(data.org.internal_notes ?? '')
      setSubdomain(data.org.subdomain ?? '')
      setEmail(clientEmail(data.org))
      setPhone(data.org.phone ?? '')
      setBillingPlan(normalizeClientPlan(data.org.billing_plan))
      setAccountStatus(data.org.account_status ?? 'active')
    }
  }, [data?.org])

  async function sendResetEmail(emailAddress: string) {
    const { error: err } = await supabase.auth.resetPasswordForEmail(emailAddress)
    if (err) alert(err.message)
    else alert('Password reset email sent.')
  }

  if (isLoading) {
    return (
      <AdminPageShell title="Client">
        <QueryLoading rows={4} />
      </AdminPageShell>
    )
  }

  if (isError || !data) {
    return (
      <AdminPageShell title="Client">
        <QueryError message={error?.message ?? 'Not found'} />
      </AdminPageShell>
    )
  }

  const org = data.org
  const tenantUrl = getOrganizationOrigin({
    subdomain: org.subdomain,
    custom_domain: org.custom_domain,
  })
  const eventCounts = countClientEvents(data.events)
  const initials = organizationInitials(org.name)
  const contactEmail = clientEmail(org)

  return (
    <AdminPageShell title={org.name} subtitle="Client organization details.">
      <div className="space-y-6">
        <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            {org.logo_url ? (
              <img
                src={org.logo_url}
                alt=""
                className="border-border/80 size-14 shrink-0 rounded-full border object-cover"
              />
            ) : (
              <div className="bg-muted text-muted-foreground flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-foreground text-lg font-semibold">{org.name}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Plan: {formatClientPlanLabel(org.billing_plan)}
              </p>
              <p className="text-muted-foreground mt-1 text-sm capitalize">
                Status: {org.account_status}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
        </Card>

        <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
          <div>
            <Label htmlFor="tenant-url">Tenant URL</Label>
            <p id="tenant-url" className="text-foreground mt-1 font-mono text-sm">
              {tenantUrl}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subdomain">Subdomain</Label>
            <Input
              id="subdomain"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              className="bg-background max-w-xs font-mono"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="client-email">Email</Label>
              <Input
                id="client-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background"
                placeholder="contact@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-phone">Phone</Label>
              <Input
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
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="billing-plan">Billing plan</Label>
              <select
                id="billing-plan"
                value={billingPlan}
                onChange={(e) => setBillingPlan(e.target.value)}
                className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
              >
                {CLIENT_PLAN_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-status">Account status</Label>
              <select
                id="account-status"
                value={accountStatus}
                onChange={(e) => setAccountStatus(e.target.value)}
                className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <Card className="border-border/80 bg-card p-6 shadow-sm">
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
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const memberEmail = window.prompt('User email for reset')
                    if (memberEmail) void sendResetEmail(memberEmail)
                  }}
                >
                  Send reset email
                </Button>
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
                  onClick={() => void sendResetEmail(m.email)}
                >
                  Send reset email
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="border-border/80 space-y-3 bg-card p-6 shadow-sm">
          <Label>Internal notes</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
          />
        </Card>
      </div>

      <FormSaveFooter
        label="Save client"
        saving={updateClient.isPending}
        onSave={() => {
          if (!clientId) return
          void updateClient.mutateAsync({
            orgId: clientId,
            notes,
            subdomain,
            email,
            phone,
            billing_plan: billingPlan,
            account_status: accountStatus,
          })
        }}
      />
    </AdminPageShell>
  )
}
