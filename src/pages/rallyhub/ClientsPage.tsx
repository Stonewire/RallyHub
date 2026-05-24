import { Link } from 'react-router-dom'

import { AccentButton } from '@/components/admin/AccentButton'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useRallyHubClients } from '@/hooks/use-rallyhub'
import { getOrganizationOrigin } from '@/lib/tenant'
import { supabase } from '@/lib/supabase'

export function RallyHubClientsPage() {
  const { data, isLoading, isError, error, refetch } = useRallyHubClients()

  async function addClient() {
    const name = window.prompt('Organization name')
    const email = window.prompt('Admin email')
    const password = window.prompt('Default password', 'Welcome123!')
    const subdomain = window.prompt('Subdomain (e.g. afterglow)', '')
    if (!name?.trim() || !email?.trim() || !password) return

    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token
    if (!token) {
      alert('Sign in required')
      return
    }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-client`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        password,
        subdomain: subdomain?.trim() || undefined,
      }),
    })
    const json = (await res.json()) as { error?: string }
    if (!res.ok) {
      alert(json.error ?? 'Failed to create client')
      return
    }
    void refetch()
  }

  return (
    <AdminPageShell
      title="Clients"
      subtitle="All organizations on the platform."
      actions={
        <AccentButton type="button" onClick={() => void addClient()}>
          Add New Client
        </AccentButton>
      }
    >
      {isLoading ? (
        <QueryLoading rows={6} />
      ) : isError ? (
        <QueryError message={error?.message} />
      ) : (
        <Card className="border-border/80 overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border/80 border-b text-left">
                  <th className="text-muted-foreground px-4 py-3 font-medium">Name</th>
                  <th className="text-muted-foreground px-4 py-3 font-medium">Tenant URL</th>
                  <th className="text-muted-foreground px-4 py-3 font-medium">Email</th>
                  <th className="text-muted-foreground px-4 py-3 font-medium">Plan</th>
                  <th className="text-muted-foreground px-4 py-3 font-medium">Completed</th>
                  <th className="text-muted-foreground px-4 py-3 font-medium">Upcoming</th>
                  <th className="text-muted-foreground px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((row) => (
                  <tr key={row.id} className="border-border/60 border-b last:border-0">
                    <td className="text-foreground px-4 py-3 font-medium">{row.name}</td>
                    <td className="text-muted-foreground max-w-[200px] truncate px-4 py-3 font-mono text-xs">
                      {getOrganizationOrigin({
                        subdomain: row.subdomain,
                        custom_domain: row.custom_domain,
                      })}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {row.contact_email ?? '—'}
                    </td>
                    <td className="px-4 py-3 capitalize">{row.billing_plan}</td>
                    <td className="px-4 py-3 tabular-nums">{row.completedEvents}</td>
                    <td className="px-4 py-3 tabular-nums">{row.upcomingEvents}</td>
                    <td className="px-4 py-3 capitalize">{row.account_status}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/admin/clients/${row.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AdminPageShell>
  )
}
