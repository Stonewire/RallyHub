import { cn } from '@/lib/utils'
import type { SupportTicketRow } from '@/hooks/use-support-tickets'

type SupportTicketCardProps = {
  ticket: SupportTicketRow
  selected?: boolean
  onClick: () => void
  orgLabel?: string
}

function formatTicketTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function SupportTicketCard({
  ticket,
  selected,
  onClick,
  orgLabel,
}: SupportTicketCardProps) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'border-border/80 bg-card hover:border-border flex cursor-pointer flex-col gap-2 rounded-lg border p-3 shadow-sm transition-colors',
        selected && 'ring-primary border-primary/50 ring-2',
      )}
    >
      <div className="min-w-0">
        <p className="text-foreground line-clamp-2 text-sm font-medium leading-snug">
          {ticket.subject}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {ticket.ticket_number ? (
            <span className="font-mono">{ticket.ticket_number}</span>
          ) : (
            <span className="font-mono">{ticket.id.slice(0, 8)}…</span>
          )}
          {' · '}
          {formatTicketTime(ticket.updated_at)}
        </p>
        {orgLabel ? (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">{orgLabel}</p>
        ) : null}
      </div>
    </article>
  )
}
