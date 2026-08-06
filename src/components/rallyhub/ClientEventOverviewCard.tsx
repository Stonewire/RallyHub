import { IconEvents, IconEye, IconLocation, IconTrash } from '@/components/icons'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { NeoButton, NeoInput, NeoStatusBadge, type NeoStatusBadgeTone } from '@/components/neo-minimal'
import {
  formatClientEventDate,
  isEventInvoicePaid,
  type ClientEventRow,
} from '@/lib/client-event-overview'
import { isEventDemoStatus } from '@/lib/event-demo'
import { parseBrandColors } from '@/lib/event-form-utils'
import { deleteEventPermanently } from '@/lib/reset-event-data'

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
  /** Called after a permanent delete succeeds, so the list can refresh. */
  onDeleted?: () => void
}

/**
 * The client's own event card, read-only: same title, facts strip and status
 * badge, with the interactive status menu and duplicate removed. Super admins
 * get a guarded permanent delete: media, teams, submissions and the event
 * itself (an invoiced event keeps its bare billing stub).
 */
export function ClientEventOverviewCard({
  event,
  clientPlan,
  hideInvoiceState = false,
  clientId,
  onDeleted,
}: ClientEventOverviewCardProps) {
  const isDemo = isEventDemoStatus(event.status)
  const invoicePaid = isEventInvoicePaid(event, clientPlan)
  const colors = parseBrandColors(event.brand_colors)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteEventPermanently(event.id)
      setDeleteOpen(false)
      onDeleted?.()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

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
        <div className="ml-auto flex items-center gap-2">
          {onDeleted ? (
            <NeoButton
              variant="ghost"
              size="sm"
              className="text-destructive"
              title="Delete this event permanently"
              onClick={() => {
                setConfirmName('')
                setDeleteError(null)
                setDeleteOpen(true)
              }}
            >
              <IconTrash className="size-3.5" />
            </NeoButton>
          ) : null}
          {clientId ? (
            <NeoButton variant="surface" size="sm" asChild>
              <Link to={`/admin/clients/${clientId}/events/${event.id}`}>
                <IconEye className="size-3.5" />
                View
              </Link>
            </NeoButton>
          ) : null}
        </div>
      </div>

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="border-border/80 bg-card w-full max-w-md rounded-lg border p-6 shadow-xl">
            <h3 className="text-foreground text-base font-bold">
              Permanently delete “{event.name}”?
            </h3>
            <p className="text-muted-foreground mt-2 text-sm">
              This removes the event with all its teams, submissions, chat and
              media for this client. It cannot be undone.
              {event.invoiced_at
                ? ' The invoice record is kept for billing history.'
                : ''}
            </p>
            <p className="text-muted-foreground mt-3 text-xs">
              Type the event name to confirm:
            </p>
            <NeoInput
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={event.name}
              className="mt-1.5"
            />
            {deleteError ? (
              <p className="text-destructive mt-2 text-sm" role="alert">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <NeoButton
                type="button"
                variant="surface"
                size="sm"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
              >
                Cancel
              </NeoButton>
              <NeoButton
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleting || confirmName.trim() !== event.name}
                onClick={() => void handleDelete()}
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </NeoButton>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}
