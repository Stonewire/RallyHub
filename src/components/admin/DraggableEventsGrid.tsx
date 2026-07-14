import { Copy, Eye, GripVertical, Link2, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { EventStatusMenu } from '@/components/events/EventStatusMenu'
import { NeoButton } from '@/components/neo-minimal'
import { EVENT_STATUS_LABELS, groupEventsByStatus, type EventRow } from '@/hooks/use-events'
import { canTransitionEventStatus, isEventActivated } from '@/lib/event-lifecycle'
import type { EventStatus } from '@/types/database'

function formatEventDate(iso: string | null) {
  if (!iso) return 'Date not set'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

type DraggableEventsGridProps = {
  events: EventRow[]
  statusPending: boolean
  deleting: boolean
  onStatusChange: (eventId: string, status: EventStatus) => void
  onDelete: (event: EventRow) => void
  onViewLinks: (event: EventRow) => void
  onDuplicate: (event: EventRow) => void
  onReorder: (eventId: string, status: EventStatus, indexInGroup: number) => void
  duplicating?: boolean
}

export function DraggableEventsGrid({
  events,
  statusPending,
  deleting,
  onStatusChange,
  onDelete,
  onViewLinks,
  onDuplicate,
  onReorder,
  duplicating = false,
}: DraggableEventsGridProps) {
  const navigate = useNavigate()
  const [dragId, setDragId] = useState<string | null>(null)

  const sorted = [...events].sort((a, b) => {
    if (a.list_order !== b.list_order) return a.list_order - b.list_order
    const da = a.event_date ?? ''
    const db = b.event_date ?? ''
    return da.localeCompare(db)
  })

  const groups = groupEventsByStatus(sorted)

  function handleDrop(targetStatus: EventStatus, targetEventId: string | null) {
    if (!dragId) return
    const dragged = events.find((e) => e.id === dragId)
    if (!dragged) return

    if (
      targetStatus !== dragged.status &&
      !canTransitionEventStatus(dragged, targetStatus)
    ) {
      setDragId(null)
      return
    }

    const groupEvents = sorted
      .filter((e) => e.status === targetStatus)
      .filter((e) => e.id !== dragId)

    let index = groupEvents.length
    if (targetEventId) {
      const idx = groupEvents.findIndex((e) => e.id === targetEventId)
      if (idx >= 0) index = idx
    }

    onReorder(dragId, targetStatus, index)
    setDragId(null)
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.status}>
          <h3 className="text-foreground mb-3 text-sm font-semibold">
            {group.label}{' '}
            <span className="text-muted-foreground font-normal">({group.events.length})</span>
          </h3>
          <div
            className="grid gap-3 sm:grid-cols-2"
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(e) => {
              e.preventDefault()
              handleDrop(group.status, null)
            }}
          >
            {group.events.map((event) => {
              const activated = isEventActivated(event)
              const canDrag =
                !activated || (event.status as EventStatus) !== 'archived'

              return (
              <article
                key={event.id}
                draggable={canDrag}
                onDragStart={(e) => {
                  setDragId(event.id)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', event.id)
                }}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleDrop(group.status, event.id)
                }}
                className="border-border/80 bg-card hover:border-border flex cursor-pointer flex-col gap-2 rounded-lg border p-3 shadow-sm transition-colors"
                onClick={() => navigate(`/admin/events/${event.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/admin/events/${event.id}`)
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-start gap-2">
                  <GripVertical
                    className="text-muted-foreground mt-0.5 size-4 shrink-0 cursor-grab active:cursor-grabbing"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className="flex flex-wrap items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <p className="text-foreground line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug">
                        {event.name}
                      </p>
                      <EventStatusMenu
                        status={event.status as EventStatus}
                        activatedAt={event.activated_at}
                        disabled={statusPending}
                        onSelect={(status) => onStatusChange(event.id, status)}
                      />
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {formatEventDate(event.event_date)} · {event.team_count} teams
                    </p>
                  </div>
                </div>
                <div
                  className="flex flex-wrap gap-1.5 pl-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  {(event.status as EventStatus) === 'archived' ? (
                    // Archived events are read-only: view details or duplicate — no editing.
                    <>
                      <NeoButton variant="surface" size="sm" asChild>
                        <Link to={`/admin/events/${event.id}`}>
                          <Eye className="size-3" />
                          View
                        </Link>
                      </NeoButton>
                      <NeoButton
                        type="button"
                        variant="surface"
                        size="sm"
                        disabled={duplicating}
                        onClick={() => onDuplicate(event)}
                      >
                        <Copy className="size-3" />
                        {duplicating ? 'Duplicating…' : 'Duplicate'}
                      </NeoButton>
                    </>
                  ) : (
                    <>
                      <NeoButton
                        type="button"
                        variant="surface"
                        size="sm"
                        onClick={() => onViewLinks(event)}
                      >
                        <Link2 className="size-3" />
                        View Links
                      </NeoButton>
                      <NeoButton variant="surface" size="sm" asChild>
                        <Link to={`/admin/events/${event.id}`}>
                          <Pencil className="size-3" />
                          Edit
                        </Link>
                      </NeoButton>
                    </>
                  )}
                  <NeoButton
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={deleting}
                    onClick={() => onDelete(event)}
                  >
                    <Trash2 className="size-3" />
                    Delete
                  </NeoButton>
                </div>
              </article>
              )
            })}
            {group.events.length === 0 ? (
              <p className="text-muted-foreground col-span-2 py-4 text-center text-xs">
                Drop events here to set status to {EVENT_STATUS_LABELS[group.status]}
              </p>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  )
}
