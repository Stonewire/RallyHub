import { IconEvents, IconEye, IconLocation } from '@/components/icons'
import { Link } from 'react-router-dom'

import { NeoButton, NeoStatusBadge, type NeoStatusBadgeTone } from '@/components/neo-minimal'
import {
  formatClientEventDate,
  isEventInvoicePaid,
  type ClientEventRow,
} from '@/lib/client-event-overview'
import { isEventDemoStatus } from '@/lib/event-demo'
import { parseBrandColors } from '@/lib/event-form-utils'

function displayLayoutLabel(value: string | null) {
  return value === 'orbit_view' ? 'Orbit' : 'Rank list'
}

type ClientEventOverviewCardProps = {
  event: ClientEventRow
  clientPlan: string | null | undefined
  /** Demo organisations bill nobody, so their invoice badges are noise. */
  hideInvoiceState?: boolean
  /** Enables the read-only View link when the owning client is known. */
  clientId?: string
}

/**
 * The client's own event card, read-only: same title, facts strip and status
 * badge, with the interactive status menu and duplicate/delete removed.
 */
export function ClientEventOverviewCard({
  event,
  clientPlan,
  hideInvoiceState = false,
  clientId,
}: ClientEventOverviewCardProps) {
  const isDemo = isEventDemoStatus(event.status)
  const invoicePaid = isEventInvoicePaid(event, clientPlan)
  const colors = parseBrandColors(event.brand_colors)

  return (
    <article className="border-border/80 bg-card flex flex-col rounded-lg border p-4 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-nm-slate-400 hover:shadow-md">
      <div className="flex items-start gap-2">
        <h3 className="text-foreground line-clamp-2 min-w-0 flex-1 text-base leading-tight font-bold">
          {event.name}
        </h3>
        <NeoStatusBadge tone={event.status as NeoStatusBadgeTone}>{event.status}</NeoStatusBadge>
      </div>
      <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
        <p className="flex items-center gap-1.5">
          <IconEvents className="size-3.5" />
          {formatClientEventDate(event.event_date)}
        </p>
        {event.location ? (
          <p className="flex min-w-0 items-center gap-1.5">
            <IconLocation className="size-3.5 shrink-0" />
            <span className="truncate">{event.location}</span>
          </p>
        ) : null}
      </div>

      <div className="border-border/70 mt-3 grid grid-cols-4 gap-2 border-t pt-3 text-center">
        <div>
          <p className="text-muted-foreground text-[9px] font-semibold tracking-[0.06em] uppercase">
            Display
          </p>
          <p className="text-foreground mt-1 truncate text-[11px] font-semibold">
            {displayLayoutLabel(event.display_layout)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-[9px] font-semibold tracking-[0.06em] uppercase">
            UI colour
          </p>
          <span
            className="border-border mx-auto mt-1 block size-3 rounded-full border"
            style={{ backgroundColor: event.display_text_color ?? '#ffffff' }}
          />
        </div>
        <div>
          <p className="text-muted-foreground text-[9px] font-semibold tracking-[0.06em] uppercase">
            Branding
          </p>
          <div className="mt-1.5 flex justify-center -space-x-0.5">
            {colors.map((color, index) => (
              <span
                key={`${color}-${index}`}
                className="border-card size-3 rounded-full border"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="text-muted-foreground text-[9px] font-semibold tracking-[0.06em] uppercase">
            Teams
          </p>
          <p className="text-foreground mt-1 text-[11px] font-semibold">{event.team_count}</p>
        </div>
      </div>

      <div className="border-border/70 mt-3 flex items-center gap-2 border-t pt-3">
        {isDemo || hideInvoiceState ? null : event.invoiced_at ? (
          <NeoStatusBadge tone={invoicePaid ? 'paid' : 'unpaid'}>
            Invoice {invoicePaid ? 'Paid' : 'Unpaid'}
          </NeoStatusBadge>
        ) : null}
        {clientId ? (
          <NeoButton variant="surface" size="sm" className="ml-auto" asChild>
            <Link to={`/admin/clients/${clientId}/events/${event.id}`}>
              <IconEye className="size-3.5" />
              View
            </Link>
          </NeoButton>
        ) : null}
      </div>
    </article>
  )
}
