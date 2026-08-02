import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { SupportTicketsWorkspace } from '@/components/admin/SupportTicketsWorkspace'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { supabase } from '@/lib/supabase'
import {
  TICKET_STATUS_ORDER,
  useSupportTickets,
  useUpdateTicketStatus,
  type TicketStatus,
} from '@/hooks/use-support-tickets'

export function RallyHubSupportPage() {
  const { data, isLoading, isError, error } = useSupportTickets('all')
  const updateStatus = useUpdateTicketStatus()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const tickets = data ?? []

  // Tickets only carry an organisation id. A truncated uuid tells whoever is
  // on support nothing, so the names are looked up once and mapped.
  const orgNamesQuery = useQuery({
    queryKey: ['rallyhub', 'org-names'],
    queryFn: async () => {
      const { data: orgs, error } = await supabase.from('organizations').select('id, name')
      if (error) throw error
      return orgs ?? []
    },
  })
  const orgName = useMemo(
    () => new Map((orgNamesQuery.data ?? []).map((org) => [org.id, org.name])),
    [orgNamesQuery.data],
  )
  const labelForOrg = (organizationId: string) =>
    orgName.get(organizationId) ?? `Org ${organizationId.slice(0, 8)}…`

  return (
    <AdminPageShell title="Support" subtitle="Client support tickets across the platform.">
      {isLoading ? (
        <QueryLoading rows={5} />
      ) : isError ? (
        <QueryError message={error?.message} />
      ) : (
        <SupportTicketsWorkspace
          tickets={tickets}
          selectedId={selectedId}
          onSelectTicket={setSelectedId}
          senderRole="support"
          emptyMessage="No support tickets yet."
          getOrgLabel={(ticket) => labelForOrg(ticket.organization_id)}
          renderThreadHeader={(ticket) => (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-foreground font-semibold">{ticket.subject}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {ticket.ticket_number ? (
                    <span className="font-mono">{ticket.ticket_number}</span>
                  ) : null}
                  {ticket.ticket_number ? ' · ' : null}
                  {labelForOrg(ticket.organization_id)}
                </p>
              </div>
              <select
                value={ticket.status}
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                onChange={(e) => {
                  const status = e.target.value as TicketStatus
                  void updateStatus.mutateAsync({
                    ticketId: ticket.id,
                    status,
                  })
                }}
              >
                {TICKET_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {s === 'in_progress' ? 'In Progress' : s === 'open' ? 'Open' : 'Resolved'}
                  </option>
                ))}
              </select>
            </div>
          )}
        />
      )}
    </AdminPageShell>
  )
}
