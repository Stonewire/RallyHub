import { Link } from 'react-router-dom'

import { AccentButton } from '@/components/admin/AccentButton'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { ClientCard } from '@/components/rallyhub/ClientCard'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { useRallyHubClients } from '@/hooks/use-rallyhub'

export function RallyHubClientsPage() {
  const { data, isLoading, isError, error } = useRallyHubClients()

  return (
    <AdminPageShell
      title="Clients"
      subtitle="All organizations on the platform."
      actions={
        <AccentButton asChild>
          <Link to="/admin/clients/new">Add New Client</Link>
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
