import { useTranslation } from 'react-i18next'

import { SupportTicketStatusBadge } from '@/components/admin/SupportTicketStatusBadge'
import { SupportUnreadBadge } from '@/components/admin/SupportUnreadBadge'
import type { SupportTicketRow, TicketStatus } from '@/hooks/use-support-tickets'
import { cn } from '@/lib/utils'

type SupportTicketCardProps = {
  ticket: SupportTicketRow
  selected?: boolean
  onClick: () => void
  orgLabel?: string
  unreadCount?: number
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
  unreadCount = 0,
}: SupportTicketCardProps) {
  const { t } = useTranslation('admin')

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
        'border-border/80 bg-card hover:border-border relative flex cursor-pointer flex-col gap-2 rounded-lg border p-3 shadow-sm transition-colors',
        selected && 'ring-primary border-primary/50 ring-2',
      )}
    >
      {unreadCount > 0 ? (
        <SupportUnreadBadge
          count={unreadCount}
          className="absolute right-2 top-2"
          label={t('support.unreadMessages', { count: unreadCount })}
        />
      ) : null}
      <div className="min-w-0 pr-6">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <SupportTicketStatusBadge status={ticket.status as TicketStatus} />
        </div>
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
