import { Link } from 'react-router-dom'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { ClientCard } from '@/components/rallyhub/ClientCard'
import { NeoButton, NeoPageShell } from '@/components/neo-minimal'
import { useRallyHubClients } from '@/hooks/use-rallyhub'

export function RallyHubClientsPage() {
  const { data, isLoading, isError, error } = useRallyHubClients()

  return (
    <NeoPageShell
      title="Clients"
      subtitle="All organizations on the platform."
      actions={
        <NeoButton variant="accent" size="md" asChild>
          <Link to="/admin/clients/new">Add New Client</Link>
        </NeoButton>
      }
    >
      {isLoading ? (
        <QueryLoading rows={6} />
      ) : isError ? (
        <QueryError message={error?.message} />
      ) : (data ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">No clients yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(data ?? []).map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </NeoPageShell>
  )
}
