import {
  formatClientEventDate,
  isEventInvoicePaid,
  type ClientEventRow,
} from '@/lib/client-event-overview'
import { isEventDemoStatus } from '@/lib/event-demo'
import { cn } from '@/lib/utils'

type ClientEventOverviewCardProps = {
  event: ClientEventRow
  clientPlan: string | null | undefined
}

export function ClientEventOverviewCard({ event, clientPlan }: ClientEventOverviewCardProps) {
  const isDemo = isEventDemoStatus(event.status)
  const invoicePaid = isEventInvoicePaid(event, clientPlan)

  return (
    <article className="neo-card flex flex-col gap-2 p-3">
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
      {isDemo ? (
        <span
          className={cn(
            'inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            'bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200',
          )}
        >
          Demo
        </span>
      ) : event.invoiced_at ? (
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
      ) : null}
    </article>
  )
}
