import { useTranslation } from 'react-i18next'

import { NeoStatusBadge } from '@/components/neo-minimal'
import {
  TICKET_STATUS_LABEL_KEYS,
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
  const { t } = useTranslation('admin')
  return (
    <NeoStatusBadge tone={status} className={className}>
      {t(TICKET_STATUS_LABEL_KEYS[status])}
    </NeoStatusBadge>
  )
}
