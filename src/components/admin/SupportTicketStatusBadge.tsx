import { NeoStatusBadge } from '@/components/neo-minimal'
import {
  TICKET_STATUS_LABELS,
  type TicketStatus,
} from '@/hooks/use-support-tickets'

type SupportTicketStatusBadgeProps = {
  status: TicketStatus
  className?: string
}

/**
 * Ticket status as the shared colour badge, so support reads the same as
 * every other status in the panel. The old dot-plus-label style is gone.
 */
export function SupportTicketStatusBadge({ status, className }: SupportTicketStatusBadgeProps) {
  return (
    <NeoStatusBadge tone={status} className={className}>
      {TICKET_STATUS_LABELS[status]}
    </NeoStatusBadge>
  )
}
