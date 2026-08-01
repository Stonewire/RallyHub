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
  /** Demo organisations bill nobody, so their invoice badges are noise. */
  hideInvoiceState?: boolean
}

export function ClientEventOverviewCard({
  event,
  clientPlan,
  hideInvoiceState = false,
}: ClientEventOverviewCardProps) {
  const isDemo = isEventDemoStatus(event.status)
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
      {isDemo ? (
        <NeoStatusBadge tone="demo-event">Demo</NeoStatusBadge>
      ) : hideInvoiceState ? null : event.invoiced_at ? (
        <NeoStatusBadge tone={invoicePaid ? 'paid' : 'unpaid'}>
          Invoice {invoicePaid ? 'Paid' : 'Unpaid'}
        </NeoStatusBadge>
      ) : null}
    </article>
  )
}
