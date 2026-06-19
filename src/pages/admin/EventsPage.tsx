import { Calendar } from 'lucide-react'
import { useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'

import { DraggableEventsGrid } from '@/components/admin/DraggableEventsGrid'
import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { EventLinksModal } from '@/components/events/EventLinksModal'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useNotification } from '@/contexts/notification-context'
import {
  STATUS_ORDER,
  useDeleteEvent,
  useDuplicateEvent,
  useEvents,
  useUpdateEventStatus,
  type EventRow,
} from '@/hooks/use-events'
import { useEventActivationFlow } from '@/hooks/use-event-activation-flow'
import { useOrganization } from '@/hooks/use-organization-settings'
import { useOrganizationId } from '@/hooks/use-organization-id'
import {
  canTransitionEventStatus,
  eventStatusTransitionError,
} from '@/lib/event-lifecycle'
import { brandColorsForEvent, logoForEvent } from '@/lib/live-event'
import { supabase } from '@/lib/supabase'
import type { EventStatus } from '@/types/database'
import { useState } from 'react'

export function AdminEventsPage() {
  const organizationId = useOrganizationId()
  const orgQuery = useOrganization(organizationId)
  const eventsQuery = useEvents(organizationId)
  const deleteEvent = useDeleteEvent(organizationId)
  const updateStatus = useUpdateEventStatus(organizationId)
  const duplicateEvent = useDuplicateEvent(organizationId)
  const navigate = useNavigate()
  const { notify } = useNotification()
  const activation = useEventActivationFlow({
    billingPlan: orgQuery.data?.billing_plan,
    organizationId,
    onValidationError: notify,
  })

  const [linksModal, setLinksModal] = useState<EventRow | null>(null)
  const [deleteConfirmEvent, setDeleteConfirmEvent] = useState<EventRow | null>(null)

  const applyReorder = useCallback(
    async (eventId: string, newStatus: EventStatus, indexInGroup: number) => {
      const all = eventsQuery.data ?? []
      const moving = all.find((e) => e.id === eventId)
      if (!moving) return

      const rest = all.filter((e) => e.id !== eventId)
      const byStatus: Record<EventStatus, EventRow[]> = {
        active: [],
        demo: [],
        ready: [],
        draft: [],
        archived: [],
      }
      for (const e of rest) {
        const s = e.status as EventStatus
        if (byStatus[s]) byStatus[s].push(e)
      }
      const updated = { ...moving, status: newStatus }
      byStatus[newStatus].splice(indexInGroup, 0, updated)

      const updates: { id: string; status: EventStatus; list_order: number }[] = []
      for (const status of STATUS_ORDER) {
        byStatus[status].forEach((e, i) => {
          updates.push({ id: e.id, status, list_order: i })
        })
      }

      await Promise.all(
        updates.map((u) =>
          supabase
            .from('events')
            .update({ status: u.status, list_order: u.list_order })
            .eq('id', u.id),
        ),
      )
      await eventsQuery.refetch()
    },
    [eventsQuery],
  )

  function handleStatusChange(eventId: string, status: EventStatus) {
    const event = eventsQuery.data?.find((e) => e.id === eventId)
    if (!event) return
    const transitionError = eventStatusTransitionError(event, status)
    if (transitionError) {
      notify(transitionError)
      return
    }
    activation.requestStatusChange(
      event.status as EventStatus,
      status,
      event.name,
      event.invoiced_at,
      () => updateStatus.mutateAsync({ eventId, status }),
    )
  }

  function handleReorder(eventId: string, newStatus: EventStatus, indexInGroup: number) {
    const event = eventsQuery.data?.find((e) => e.id === eventId)
    if (!event) return
    if (
      newStatus !== event.status &&
      !canTransitionEventStatus(event, newStatus)
    ) {
      notify(eventStatusTransitionError(event, newStatus) ?? 'Status change not allowed.')
      return
    }
    activation.requestStatusChange(
      event.status as EventStatus,
      newStatus,
      event.name,
      event.invoiced_at,
      () => applyReorder(eventId, newStatus, indexInGroup),
    )
  }

  function handleDelete(event: EventRow) {
    setDeleteConfirmEvent(event)
  }

  async function confirmDelete() {
    if (!deleteConfirmEvent) return
    await deleteEvent.mutateAsync(deleteConfirmEvent.id)
    setDeleteConfirmEvent(null)
  }

  async function handleDuplicate(event: EventRow) {
    try {
      const { data: links, error } = await supabase
        .from('event_games')
        .select('game_id')
        .eq('event_id', event.id)
      if (error) throw error
      const gameIds = (links ?? []).map((l) => l.game_id)
      const copy = await duplicateEvent.mutateAsync({ source: event, gameIds })
      navigate(`/admin/events/${copy.id}`)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not duplicate event')
    }
  }

  if (!organizationId) {
    return (
      <AdminPageShell title="Events" subtitle="Schedule and oversee live team events.">
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  const events = eventsQuery.data ?? []

  return (
    <AdminPageShell
      title="Events"
      subtitle="Drag cards to reorder or move between status groups. Click a card to edit."
      actions={
        <NeoButton variant="accent" asChild>
          <Link to="/admin/events/new">Create New Event</Link>
        </NeoButton>
      }
    >
      {eventsQuery.isLoading ? (
        <QueryLoading rows={5} />
      ) : eventsQuery.isError ? (
        <QueryError message={eventsQuery.error.message} />
      ) : events.length === 0 ? (
        <Card className="border-border/80 flex flex-col items-center justify-center gap-3 bg-card px-6 py-16 text-center shadow-sm">
          <Calendar className="text-muted-foreground size-10 opacity-60" />
          <p className="text-foreground font-medium">No events yet</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Create an event to schedule team activities and manage live sessions.
          </p>
          <NeoButton variant="accent" asChild className="mt-2">
            <Link to="/admin/events/new">Create New Event</Link>
          </NeoButton>
        </Card>
      ) : (
        <DraggableEventsGrid
          events={events}
          deleting={deleteEvent.isPending}
          statusPending={updateStatus.isPending || activation.confirmingActivation}
          onStatusChange={handleStatusChange}
          onDelete={(e) => void handleDelete(e)}
          onViewLinks={setLinksModal}
          onDuplicate={(e) => void handleDuplicate(e)}
          duplicating={duplicateEvent.isPending}
          onReorder={handleReorder}
        />
      )}

      <activation.ActivationDialog />

      {deleteConfirmEvent ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-event-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        >
          <div className="bg-card border-border/80 w-full max-w-sm rounded-xl border p-6 shadow-lg">
            <h2 id="delete-event-title" className="text-foreground mb-2 font-semibold">Delete event</h2>
            <p className="text-muted-foreground mb-5 text-sm">
              Delete <strong className="text-foreground">{deleteConfirmEvent.name}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirmEvent(null)}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteEvent.isPending}
                onClick={() => void confirmDelete()}
              >
                {deleteEvent.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      {linksModal ? (
        <EventLinksModal
          eventId={linksModal.id}
          eventName={linksModal.name}
          organization={
            orgQuery.data
              ? {
                  subdomain: orgQuery.data.subdomain,
                  custom_domain: orgQuery.data.custom_domain,
                }
              : null
          }
          branding={{
            eventName: linksModal.name,
            logoUrl: logoForEvent(linksModal, orgQuery.data ?? null),
            primaryColor: brandColorsForEvent(linksModal, orgQuery.data ?? null)[0],
            accentColor: brandColorsForEvent(linksModal, orgQuery.data ?? null)[2],
          }}
          onClose={() => setLinksModal(null)}
        />
      ) : null}
    </AdminPageShell>
  )
}
