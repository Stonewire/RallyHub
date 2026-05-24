import { Link } from 'react-router-dom'

import { AccentButton } from '@/components/admin/AccentButton'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useRallyHubClients } from '@/hooks/use-rallyhub'
import { supabase } from '@/lib/supabase'

export function RallyHubClientsPage() {
  const { data, isLoading, isError, error, refetch } = useRallyHubClients()

  async function addClient() {
    const name = window.prompt('Organization name')
    const email = window.prompt('Admin email')
    const password = window.prompt('Default password', 'Welcome123!')
    if (!name?.trim() || !email?.trim() || !password) return

    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .insert({ name: name.trim(), contact_email: email.trim() })
      .select()
      .single()
    if (orgErr) {
      alert(orgErr.message)
      return
    }

    const { data: auth, error: authErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })
    if (authErr) {
      alert(authErr.message)
      return
    }
    if (auth.user) {
      await supabase
        .from('profiles')
        .update({ organization_id: org.id, role: 'client_admin' })
        .eq('id', auth.user.id)
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
                    <td className="text-muted-foreground px-4 py-3">
                      {row.contact_email ?? '—'}
                    </td>
                    <td className="px-4 py-3 capitalize">{row.billing_plan}</td>
                    <td className="px-4 py-3 tabular-nums">{row.completedEvents}</td>
                    <td className="px-4 py-3 tabular-nums">{row.upcomingEvents}</td>
                    <td className="px-4 py-3 capitalize">{row.account_status}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/rallyhub/clients/${row.id}`}>View</Link>
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
