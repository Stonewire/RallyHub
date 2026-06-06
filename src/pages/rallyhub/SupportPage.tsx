import { useState } from 'react'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { SupportTicketsWorkspace } from '@/components/admin/SupportTicketsWorkspace'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
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

  return (
    <AdminPageShell
      title="Support"
      subtitle="Client support tickets across the platform."
    >
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
          showStatusOnCard
          getOrgLabel={(ticket) => `Org ${ticket.organization_id.slice(0, 8)}…`}
          renderThreadHeader={(ticket) => (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-foreground font-semibold">{ticket.subject}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {ticket.ticket_number ? (
                    <span className="font-mono">{ticket.ticket_number}</span>
                  ) : null}
                  {ticket.ticket_number ? ' · ' : null}
                  Org {ticket.organization_id.slice(0, 8)}…
                </p>
              </div>
              <select
                value={ticket.status}
                className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
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
