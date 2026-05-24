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
import { getOrganizationOrigin } from '@/lib/tenant'
import { supabase } from '@/lib/supabase'

const PLANS = ['starter', 'pro', 'enterprise'] as const
const STATUSES = ['active', 'suspended', 'trial'] as const

export function RallyHubClientDetailPage() {
  const { clientId } = useParams()
  const { data, isLoading, isError, error } = useRallyHubClient(clientId)
  const updateClient = useUpdateClientAdmin()
  const [notes, setNotes] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [billingPlan, setBillingPlan] = useState('starter')
  const [accountStatus, setAccountStatus] = useState('active')

  useEffect(() => {
    if (data?.org) {
      setNotes(data.org.internal_notes ?? '')
      setSubdomain(data.org.subdomain ?? '')
      setBillingPlan(data.org.billing_plan ?? 'starter')
      setAccountStatus(data.org.account_status ?? 'active')
    }
  }, [data?.org])

  async function sendResetEmail(email: string) {
    const { error: err } = await supabase.auth.resetPasswordForEmail(email)
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

  return (
    <AdminPageShell title={org.name} subtitle="Client organization details.">
      <div className="space-y-6">
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
              <Label htmlFor="billing-plan">Billing plan</Label>
              <select
                id="billing-plan"
                value={billingPlan}
                onChange={(e) => setBillingPlan(e.target.value)}
                className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
              >
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {p}
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
          <p className="text-muted-foreground text-sm">
            Events: {data.events.length} total
          </p>
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
                    const email = window.prompt('User email for reset')
                    if (email) void sendResetEmail(email)
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
            billing_plan: billingPlan,
            account_status: accountStatus,
          })
        }}
      />
    </AdminPageShell>
  )
}
