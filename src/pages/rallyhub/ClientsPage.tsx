import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { IconOrganisation, IconSearch } from '@/components/icons'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { ClientCard } from '@/components/rallyhub/ClientCard'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useRallyHubClients } from '@/hooks/use-rallyhub'

type StatusFilter = 'all' | 'active' | 'trial' | 'attention'

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'trial', label: 'Trial' },
  // One bucket for anything that wants a human: an unpaid invoice, or a trial
  // flagged for review. Those are the two reasons to open a client unprompted.
  { value: 'attention', label: 'Needs attention' },
]

export function RallyHubClientsPage() {
  const { data, isLoading, isError, error } = useRallyHubClients()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')

  const clients = useMemo(() => data ?? [], [data])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return clients.filter((client) => {
      if (filter === 'trial' && client.account_status !== 'trial') return false
      if (filter === 'active' && client.account_status === 'trial') return false
      if (
        filter === 'attention' &&
        !(client.trial_review_needed || (client.unpaidInvoiceCount ?? 0) > 0)
      ) {
        return false
      }
      if (!query) return true
      return (
        client.name.toLowerCase().includes(query) ||
        (client.email ?? '').toLowerCase().includes(query) ||
        (client.contact_email ?? '').toLowerCase().includes(query)
      )
    })
  }, [clients, filter, search])

  return (
    <AdminPageShell
      title="Clients"
      subtitle="All organizations on the platform."
      actions={
        <NeoButton variant="accent" asChild>
          <Link to="/admin/clients/new">Add New Client</Link>
        </NeoButton>
      }
    >
      {/* The Games Library band: filters on the left, search on the right,
          every control h-9. */}
      <div className="border-border/70 mb-6 flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`h-9 rounded-full border px-4 text-xs font-semibold transition-colors ${
                filter === value
                  ? 'border-nm-slate-800 bg-nm-slate-800 dark:border-nm-slate-700 dark:bg-nm-slate-700 text-white'
                  : 'border-border bg-card text-muted-foreground hover:border-nm-slate-400 hover:text-foreground'
              }`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-52 lg:max-w-sm lg:flex-1">
          <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search clients…"
            className="bg-card h-9 pl-8 text-xs"
          />
        </div>
      </div>

      {isLoading ? (
        <QueryLoading rows={6} />
      ) : isError ? (
        <QueryError message={error?.message} />
      ) : clients.length === 0 ? (
        <Card className="border-border/80 flex flex-col items-center gap-3 px-6 py-16 text-center shadow-sm">
          <IconOrganisation className="text-muted-foreground size-11" />
          <h3 className="font-semibold">No clients yet</h3>
          <p className="text-muted-foreground max-w-md text-sm">
            Add your first organisation and its admin gets an invite to sign in.
          </p>
          <NeoButton variant="accent" asChild>
            <Link to="/admin/clients/new">Add New Client</Link>
          </NeoButton>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-border/80 p-10 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No clients match.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </AdminPageShell>
  )
}
