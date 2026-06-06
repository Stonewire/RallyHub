import { useMemo, useState } from 'react'

import {
  CollapsibleSection,
  loadCollapsedState,
  saveCollapsedState,
  SUPPORT_COLLAPSED_STORAGE_KEY,
} from '@/components/admin/CollapsibleSection'
import { SupportTicketCard } from '@/components/admin/SupportTicketCard'
import { SupportTicketThread } from '@/components/admin/SupportTicketThread'
import { Card } from '@/components/ui/card'
import {
  groupTicketsByStatus,
  useSupportTicketUnreadCounts,
  type SupportTicketRow,
  type SupportViewerRole,
} from '@/hooks/use-support-tickets'

type SupportTicketsWorkspaceProps = {
  tickets: SupportTicketRow[]
  selectedId: string | null
  onSelectTicket: (id: string) => void
  senderRole: SupportViewerRole
  emptyMessage?: string
  selectPrompt?: string
  getOrgLabel?: (ticket: SupportTicketRow) => string | undefined
  renderThreadHeader?: (ticket: SupportTicketRow) => React.ReactNode
}

export function SupportTicketsWorkspace({
  tickets,
  selectedId,
  onSelectTicket,
  senderRole,
  emptyMessage = 'No tickets yet.',
  selectPrompt = 'Select a ticket to view the thread.',
  getOrgLabel,
  renderThreadHeader,
}: SupportTicketsWorkspaceProps) {
  const { data: unreadByTicket = {} } = useSupportTicketUnreadCounts(senderRole)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    loadCollapsedState(SUPPORT_COLLAPSED_STORAGE_KEY),
  )
  const groups = useMemo(() => groupTicketsByStatus(tickets), [tickets])
  const selected = tickets.find((t) => t.id === selectedId) ?? null

  function toggleGroup(status: string) {
    setCollapsed((current) => {
      const next = { ...current, [status]: !current[status] }
      saveCollapsedState(next, SUPPORT_COLLAPSED_STORAGE_KEY)
      return next
    })
  }

  if (tickets.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <div className="space-y-4">
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
              <p className="text-muted-foreground py-2 text-xs">
                No {group.label.toLowerCase()} tickets.
              </p>
            ) : (
              <div className="grid gap-3">
                {group.tickets.map((ticket) => (
                  <SupportTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    selected={ticket.id === selectedId}
                    orgLabel={getOrgLabel?.(ticket)}
                    unreadCount={unreadByTicket[ticket.id] ?? 0}
                    onClick={() => onSelectTicket(ticket.id)}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>
        ))}
      </div>
      {selected ? (
        <Card className="border-border/80 space-y-4 bg-card p-4 shadow-sm sm:p-5">
          {renderThreadHeader ? (
            renderThreadHeader(selected)
          ) : (
            <div>
              <p className="text-foreground font-semibold">{selected.subject}</p>
              {selected.ticket_number ? (
                <p className="text-muted-foreground mt-1 font-mono text-xs">
                  {selected.ticket_number}
                </p>
              ) : null}
            </div>
          )}
          <SupportTicketThread ticket={selected} senderRole={senderRole} />
        </Card>
      ) : (
        <p className="text-muted-foreground text-sm">{selectPrompt}</p>
      )}
    </div>
  )
}
