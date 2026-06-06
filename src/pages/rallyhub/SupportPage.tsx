import { useMemo, useState } from 'react'

import { CollapsibleSection } from '@/components/admin/CollapsibleSection'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { SupportTicketCard } from '@/components/admin/SupportTicketCard'
import { SupportTicketThread } from '@/components/admin/SupportTicketThread'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { Card } from '@/components/ui/card'
import {
  groupTicketsByStatus,
  TICKET_STATUS_ORDER,
  useSupportTickets,
  useUpdateTicketStatus,
  type TicketStatus,
} from '@/hooks/use-support-tickets'

export function RallyHubSupportPage() {
  const { data, isLoading, isError, error } = useSupportTickets('all')
  const updateStatus = useUpdateTicketStatus()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const tickets = data ?? []
  const groups = useMemo(() => groupTicketsByStatus(tickets), [tickets])
  const selected = tickets.find((t) => t.id === selectedId) ?? null

  function toggleGroup(status: string) {
    setCollapsed((c) => ({ ...c, [status]: !c[status] }))
  }

  return (
    <AdminPageShell
      title="Support"
      subtitle="Client support tickets across the platform."
    >
      {isLoading ? (
        <QueryLoading rows={5} />
      ) : isError ? (
        <QueryError message={error?.message} />
      ) : tickets.length === 0 ? (
        <p className="text-muted-foreground text-sm">No support tickets yet.</p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <CollapsibleSection
              key={group.status}
              id={`support-${group.status}`}
              title={group.label}
              count={group.tickets.length}
              collapsed={Boolean(collapsed[group.status])}
              onToggle={() => toggleGroup(group.status)}
            >
              {group.tickets.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-xs">
                  No {group.label.toLowerCase()} tickets.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.tickets.map((ticket) => (
                    <SupportTicketCard
                      key={ticket.id}
                      ticket={ticket}
                      selected={ticket.id === selectedId}
                      orgLabel={`Org ${ticket.organization_id.slice(0, 8)}…`}
                      onClick={() =>
                        setSelectedId((id) => (id === ticket.id ? null : ticket.id))
                      }
                    />
                  ))}
                </div>
              )}
            </CollapsibleSection>
          ))}

          {selected ? (
            <Card className="border-border/80 space-y-4 bg-card p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-foreground font-semibold">{selected.subject}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {selected.ticket_number ? (
                      <span className="font-mono">{selected.ticket_number}</span>
                    ) : null}
                    {selected.ticket_number ? ' · ' : null}
                    Org {selected.organization_id.slice(0, 8)}…
                  </p>
                </div>
                <select
                  value={selected.status}
                  className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
                  onChange={(e) => {
                    const status = e.target.value as TicketStatus
                    void updateStatus.mutateAsync({
                      ticketId: selected.id,
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
              <SupportTicketThread ticket={selected} senderRole="support" />
            </Card>
          ) : null}
        </div>
      )}
    </AdminPageShell>
  )
}
