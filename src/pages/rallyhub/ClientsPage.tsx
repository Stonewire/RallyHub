import { useNavigate } from 'react-router-dom'

import { AccentButton } from '@/components/admin/AccentButton'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { ClientCard } from '@/components/rallyhub/ClientCard'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { useRallyHubClients } from '@/hooks/use-rallyhub'
import { supabase } from '@/lib/supabase'

export function RallyHubClientsPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, error, refetch } = useRallyHubClients()

  async function addClient() {
    const name = window.prompt('Organization name')
    const email = window.prompt('Admin login email (used to create the client account)')
    const password = window.prompt('Default password', 'Welcome123!')
    const subdomain = window.prompt('Subdomain (optional, e.g. afterglow)', '')
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
    const json = (await res.json()) as { error?: string; org?: { id: string } }
    if (!res.ok) {
      alert(json.error ?? 'Failed to create client')
      return
    }

    void refetch()
    if (json.org?.id) {
      navigate(`/admin/clients/${json.org.id}`)
    }
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
      ) : (data ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">No clients yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(data ?? []).map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </AdminPageShell>
  )
}
