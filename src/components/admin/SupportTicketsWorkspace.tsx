import { SupportTicketCard } from '@/components/admin/SupportTicketCard'
import { SupportTicketThread } from '@/components/admin/SupportTicketThread'
import { Card } from '@/components/ui/card'
import {
  TICKET_STATUS_LABELS,
  type SupportTicketRow,
  type SupportViewerRole,
  type TicketStatus,
} from '@/hooks/use-support-tickets'

type SupportTicketsWorkspaceProps = {
  tickets: SupportTicketRow[]
  selectedId: string | null
  onSelectTicket: (id: string) => void
  senderRole: SupportViewerRole
  emptyMessage?: string
  selectPrompt?: string
  getOrgLabel?: (ticket: SupportTicketRow) => string | undefined
  showStatusOnCard?: boolean
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
  showStatusOnCard = false,
  renderThreadHeader,
}: SupportTicketsWorkspaceProps) {
  const selected = tickets.find((t) => t.id === selectedId) ?? null

  if (tickets.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {tickets.map((ticket) => (
          <SupportTicketCard
            key={ticket.id}
            ticket={ticket}
            selected={ticket.id === selectedId}
            orgLabel={
              showStatusOnCard
                ? `${TICKET_STATUS_LABELS[ticket.status as TicketStatus]}${getOrgLabel?.(ticket) ? ` · ${getOrgLabel(ticket)}` : ''}`
                : getOrgLabel?.(ticket)
            }
            onClick={() => onSelectTicket(ticket.id)}
          />
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
