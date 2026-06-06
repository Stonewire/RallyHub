import {
  formatClientEventDate,
  isEventInvoicePaid,
  type ClientEventRow,
} from '@/lib/client-event-overview'
import { cn } from '@/lib/utils'

type ClientEventOverviewCardProps = {
  event: ClientEventRow
  clientPlan: string | null | undefined
}

export function ClientEventOverviewCard({ event, clientPlan }: ClientEventOverviewCardProps) {
  const invoicePaid = isEventInvoicePaid(event, clientPlan)

  return (
    <article className="border-border/80 bg-card flex flex-col gap-2 rounded-lg border p-3 shadow-sm">
      <div className="min-w-0">
        <p className="text-foreground line-clamp-2 text-sm font-medium leading-snug">
          {event.name}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {formatClientEventDate(event.event_date)}
          {' · '}
          {event.team_count} {event.team_count === 1 ? 'team' : 'teams'}
        </p>
      </div>
      <span
        className={cn(
          'inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
          invoicePaid
            ? 'bg-green-100 text-green-900 dark:bg-green-950/60 dark:text-green-200'
            : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
        )}
      >
        Invoice {invoicePaid ? 'Paid' : 'Unpaid'}
      </span>
    </article>
  )
}
