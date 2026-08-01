import { IconArchive, IconChevronDown, IconCopy, IconEvents, IconEye, IconGrip, IconLink, IconLocation, IconTrash } from '@/components/icons'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { EventStatusMenu } from '@/components/events/EventStatusMenu'
import { NeoButton } from '@/components/neo-minimal'
import { type EventRow } from '@/hooks/use-events'
import { canTransitionEventStatus, isEventActivated } from '@/lib/event-lifecycle'
import type { EventStatus } from '@/types/database'

function formatEventDate(iso: string | null) {
  if (!iso) return 'Date not set'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function displayLayoutLabel(value: string) {
  return value === 'orbit_view' ? 'Orbit' : 'Rank list'
}

function eventBrandColors(event: EventRow) {
  if (!Array.isArray(event.brand_colors)) return ['#ffc107', '#1f2126', '#8a8d94']
  const colors = event.brand_colors.filter((value): value is string => typeof value === 'string')
  return colors.length >= 3 ? colors.slice(0, 3) : ['#ffc107', '#1f2126', '#8a8d94']
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
  const [upcomingCollapsed, setUpcomingCollapsed] = useState(false)
  // Past events start collapsed: they accumulate forever and push the events
  // people actually care about off the screen.
  const [archivedCollapsed, setArchivedCollapsed] = useState(true)

  const sorted = [...events].sort((a, b) => {
    if (a.list_order !== b.list_order) return a.list_order - b.list_order
    const da = a.event_date ?? ''
    const db = b.event_date ?? ''
    return da.localeCompare(db)
  })

  const upcoming = sorted.filter((event) => event.status !== 'archived')
  const archived = sorted.filter((event) => event.status === 'archived')

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

  function eventCard(event: EventRow, compact = false) {
    const archivedEvent = (event.status as EventStatus) === 'archived'
    const activated = isEventActivated(event)
    const canDrag = !activated || !archivedEvent
    // A running event reads as "archive", not "delete"; the underlying action
    // is the same soft-delete either way.
    const isLive = (event.status as EventStatus) === 'active'
    const colors = eventBrandColors(event)

    return (
      <article
        key={event.id}
        draggable={canDrag}
        onDragStart={(dragEvent) => {
          setDragId(event.id)
          dragEvent.dataTransfer.effectAllowed = 'move'
          dragEvent.dataTransfer.setData('text/plain', event.id)
        }}
        onDragEnd={() => setDragId(null)}
        onDragOver={(dragEvent) => dragEvent.preventDefault()}
        onDrop={(dragEvent) => {
          dragEvent.preventDefault()
          dragEvent.stopPropagation()
          handleDrop(event.status as EventStatus, event.id)
        }}
        className={`border-border/80 bg-card hover:border-nm-slate-400 group flex cursor-pointer flex-col rounded-lg border p-4 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md ${compact ? 'opacity-80' : ''}`}
        onClick={() => navigate(`/admin/events/${event.id}`)}
        onKeyDown={(keyEvent) => {
          if (keyEvent.key === 'Enter') navigate(`/admin/events/${event.id}`)
        }}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-start gap-2">
          <IconGrip className="text-muted-foreground mt-1 size-4 shrink-0 cursor-grab opacity-0 transition-opacity group-hover:opacity-70 active:cursor-grabbing" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2" onClick={(clickEvent) => clickEvent.stopPropagation()} onKeyDown={(keyEvent) => keyEvent.stopPropagation()}>
              <h3 className={`${compact ? 'text-base' : 'min-h-11 text-lg'} text-foreground line-clamp-2 min-w-0 flex-1 font-bold leading-tight`}>
                {event.name}
              </h3>
              {/* Icon only, and only on hover, so the footer is free for the
                  actions people actually reach for. A live event is archived
                  rather than deleted: same soft-delete either way, but the
                  wording stops implying an event mid-play is being destroyed. */}
              <button
                type="button"
                title={isLive ? 'Archive event' : 'Delete event'}
                aria-label={`${isLive ? 'Archive' : 'Delete'} ${event.name}`}
                disabled={deleting}
                className={`shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-30 ${isLive ? 'text-primary hover:bg-primary/10' : 'text-destructive hover:bg-destructive/10'}`}
                onClick={() => onDelete(event)}
              >
                {isLive ? <IconArchive className="size-3.5" /> : <IconTrash className="size-3.5" />}
              </button>
              <EventStatusMenu
                status={event.status as EventStatus}
                activatedAt={event.activated_at}
                disabled={statusPending}
                onSelect={(status) => onStatusChange(event.id, status)}
              />
            </div>
            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
              <p className="flex items-center gap-1.5"><IconEvents className="size-3.5" />{formatEventDate(event.event_date)}</p>
              {event.location ? (
                <p className="flex min-w-0 items-center gap-1.5">
                  <IconLocation className="size-3.5 shrink-0" />
                  <span className="truncate">{event.location}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {!compact ? (
          <div className="border-border/70 mt-3 grid grid-cols-4 gap-2 border-t pt-3 text-center">
            <div>
              <p className="text-muted-foreground text-[9px] font-semibold uppercase tracking-[0.06em]">Display</p>
              <p className="text-foreground mt-1 truncate text-[11px] font-semibold">{displayLayoutLabel(event.display_layout)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[9px] font-semibold uppercase tracking-[0.06em]">UI colour</p>
              <span className="border-border mx-auto mt-1 block size-3 rounded-full border" style={{ backgroundColor: event.display_text_color }} />
            </div>
            <div>
              <p className="text-muted-foreground text-[9px] font-semibold uppercase tracking-[0.06em]">Branding</p>
              <div className="mt-1.5 flex justify-center -space-x-0.5">
                {colors.map((color, index) => <span key={`${color}-${index}`} className="border-card size-3 rounded-full border" style={{ backgroundColor: color }} />)}
              </div>
            </div>
            <div>
              <p className="text-muted-foreground text-[9px] font-semibold uppercase tracking-[0.06em]">Teams</p>
              <p className="text-foreground mt-1 text-[11px] font-semibold">{event.team_count}</p>
            </div>
          </div>
        ) : null}

        <div className="border-border/70 mt-3 flex gap-1.5 border-t pt-3" onClick={(clickEvent) => clickEvent.stopPropagation()}>
          {archivedEvent ? (
            <>
              <NeoButton variant="surface" size="sm" className="flex-1" asChild>
                <Link to={`/admin/events/${event.id}`}><IconEye className="size-3.5" />View</Link>
              </NeoButton>
              <NeoButton type="button" variant="surface" size="sm" className="flex-1" disabled={duplicating} onClick={() => onDuplicate(event)}>
                <IconCopy className="size-3.5" />{duplicating ? 'Duplicating…' : 'Duplicate'}
              </NeoButton>
            </>
          ) : (
            <>
              <NeoButton type="button" variant="surface" size="sm" className="flex-1" onClick={() => onViewLinks(event)}>
                <IconLink className="size-3.5" />Event Links
              </NeoButton>
              <NeoButton variant="surface" size="sm" className="flex-1" asChild>
                <Link to={`/admin/events/${event.id}`}><IconEye className="size-3.5" />View</Link>
              </NeoButton>
            </>
          )}
        </div>
      </article>
    )
  }

  function sectionHeader(
    label: string,
    count: number,
    collapsed: boolean,
    onToggle: () => void,
  ) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-[0.1em] uppercase"
      >
        <IconChevronDown
          className={`size-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`}
        />
        {label}
        <span className="text-muted-foreground/70">({count})</span>
      </button>
    )
  }

  return (
    <div className="space-y-8">
      {upcoming.length > 0 ? (
        <section>
          {sectionHeader('Upcoming Events', upcoming.length, upcomingCollapsed, () =>
            setUpcomingCollapsed((value) => !value),
          )}
          {!upcomingCollapsed ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">{upcoming.map((event) => eventCard(event))}</div>
          ) : null}
        </section>
      ) : null}
      {archived.length > 0 ? (
        <section>
          {sectionHeader('Past / Archived Events', archived.length, archivedCollapsed, () =>
            setArchivedCollapsed((value) => !value),
          )}
          {!archivedCollapsed ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(14.5rem,1fr))] gap-4">{archived.map((event) => eventCard(event, true))}</div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
