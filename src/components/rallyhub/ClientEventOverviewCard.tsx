import {
  formatClientEventDate,
  isEventInvoicePaid,
  type ClientEventRow,
} from '@/lib/client-event-overview'
import { isEventDemoStatus } from '@/lib/event-demo'

import { NeoStatusBadge } from '@/components/neo-minimal'

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
        <NeoStatusBadge tone="demo-event">Demo</NeoStatusBadge>
      ) : event.invoiced_at ? (
        <NeoStatusBadge tone={invoicePaid ? 'paid' : 'unpaid'}>
          Invoice {invoicePaid ? 'Paid' : 'Unpaid'}
        </NeoStatusBadge>
      ) : null}
    </article>
  )
}
