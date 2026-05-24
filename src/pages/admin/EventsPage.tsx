import {
  Calendar,
  Link2,
  Monitor,
  Pencil,
  Presentation,
  Trash2,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { AccentButton } from '@/components/admin/AccentButton'
import { CompactListRow } from '@/components/admin/CompactListRow'
import {
  CollapsibleSection,
  loadCollapsedState,
  saveCollapsedState,
} from '@/components/admin/CollapsibleSection'
import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { EventLinksModal } from '@/components/events/EventLinksModal'
import { EventStatusMenu } from '@/components/events/EventStatusMenu'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatusIndicator } from '@/components/ui/status-indicator'
import {
  groupEventsByStatus,
  useDeleteEvent,
  useEvents,
  useUpdateEventStatus,
} from '@/hooks/use-events'
import { useOrganizationId } from '@/hooks/use-organization-id'
import type { EventStatus } from '@/types/database'
import type { EventRow } from '@/hooks/use-events'

function formatEventDate(iso: string | null) {
  if (!iso) return 'Date not set'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function EventRow({
  event,
  onDelete,
  onStatusChange,
  onViewLinks,
  deleting,
  statusPending,
}: {
  event: EventRow
  onDelete: () => void
  onStatusChange: (status: EventStatus) => void
  onViewLinks: () => void
  deleting: boolean
  statusPending: boolean
}) {
  return (
    <CompactListRow
      actions={
        <>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/facilitator/${event.id}`} target="_blank" rel="noreferrer">
              <Presentation className="size-3.5" />
              Facilitator
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/display/${event.id}`} target="_blank" rel="noreferrer">
              <Monitor className="size-3.5" />
              Display
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/join/${event.id}`} target="_blank" rel="noreferrer">
              <Users className="size-3.5" />
              Join
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onViewLinks}>
            <Link2 className="size-3.5" />
            View Links
          </Button>
          <Button variant="ghost" size="icon-sm" asChild>
            <Link to={`/admin/events/${event.id}`} title="Edit">
              <Pencil className="size-3.5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive"
            disabled={deleting}
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </Button>
          <EventStatusMenu
            status={event.status as EventStatus}
            disabled={statusPending}
            onSelect={onStatusChange}
          />
        </>
      }
    >
      <div className="flex items-center gap-2.5">
        <StatusIndicator
          status={event.status as 'active' | 'ready' | 'draft' | 'archived'}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-medium">{event.name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {formatEventDate(event.event_date)} · {event.team_count}{' '}
            {event.team_count === 1 ? 'team' : 'teams'}
          </p>
        </div>
      </div>
    </CompactListRow>
  )
}

export function AdminEventsPage() {
  const organizationId = useOrganizationId()
  const eventsQuery = useEvents(organizationId)
  const deleteEvent = useDeleteEvent(organizationId)
  const updateStatus = useUpdateEventStatus(organizationId)

  const groups = groupEventsByStatus(eventsQuery.data ?? [])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    loadCollapsedState(),
  )
  const [linksModal, setLinksModal] = useState<{ id: string; name: string } | null>(
    null,
  )

  useEffect(() => {
    saveCollapsedState(collapsed)
  }, [collapsed])

  function toggleGroup(status: string) {
    setCollapsed((c) => ({ ...c, [status]: !c[status] }))
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    await deleteEvent.mutateAsync(id)
  }

  if (!organizationId) {
    return (
      <AdminPageShell title="Events" subtitle="Schedule and oversee live team events.">
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  return (
    <AdminPageShell
      title="Events"
      subtitle="Schedule and oversee live team events."
      actions={
        <AccentButton asChild>
          <Link to="/admin/events/new">Create New Event</Link>
        </AccentButton>
      }
    >
      {eventsQuery.isLoading ? (
        <QueryLoading rows={5} />
      ) : eventsQuery.isError ? (
        <QueryError message={eventsQuery.error.message} />
      ) : groups.length === 0 ? (
        <Card className="border-border/80 flex flex-col items-center justify-center gap-3 bg-card px-6 py-16 text-center shadow-sm">
          <Calendar className="text-muted-foreground size-10 opacity-60" />
          <p className="text-foreground font-medium">No events yet</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Create an event to schedule team activities and manage live sessions.
          </p>
          <AccentButton asChild className="mt-2">
            <Link to="/admin/events/new">Create New Event</Link>
          </AccentButton>
        </Card>
      ) : (
        <div className="border-border/80 divide-y rounded-lg border bg-card shadow-sm">
          {groups.map((group) => (
            <CollapsibleSection
              key={group.status}
              id={group.status}
              title={group.label}
              count={group.events.length}
              collapsed={Boolean(collapsed[group.status])}
              onToggle={() => toggleGroup(group.status)}
              className="px-3 py-3"
            >
              <div className="border-border/80 overflow-hidden rounded-md border">
                {group.events.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    deleting={deleteEvent.isPending}
                    statusPending={updateStatus.isPending}
                    onDelete={() => void handleDelete(event.id, event.name)}
                    onStatusChange={(status) =>
                      void updateStatus.mutateAsync({ eventId: event.id, status })
                    }
                    onViewLinks={() =>
                      setLinksModal({ id: event.id, name: event.name })
                    }
                  />
                ))}
              </div>
            </CollapsibleSection>
          ))}
        </div>
      )}

      {linksModal ? (
        <EventLinksModal
          eventId={linksModal.id}
          eventName={linksModal.name}
          onClose={() => setLinksModal(null)}
        />
      ) : null}
    </AdminPageShell>
  )
}
