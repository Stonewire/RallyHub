import {
  TICKET_STATUS_LABELS,
  type TicketStatus,
} from '@/hooks/use-support-tickets'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: 'border-yellow-300/80 bg-yellow-100 text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950/60 dark:text-yellow-200',
  in_progress:
    'border-blue-300/80 bg-blue-100 text-blue-900 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-200',
  resolved:
    'border-green-300/80 bg-green-100 text-green-900 dark:border-green-700 dark:bg-green-950/60 dark:text-green-200',
}

type SupportTicketStatusBadgeProps = {
  status: TicketStatus
  className?: string
}

export function SupportTicketStatusBadge({ status, className }: SupportTicketStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        STATUS_STYLES[status],
        className,
      )}
    >
      {TICKET_STATUS_LABELS[status]}
    </span>
  )
}
