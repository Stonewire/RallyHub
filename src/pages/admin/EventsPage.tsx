import { IconEvents, IconPlus, IconSearch } from '@/components/icons'
import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'

import { BinPanel } from '@/components/admin/BinPanel'
import { DraggableEventsGrid } from '@/components/admin/DraggableEventsGrid'
import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { EventLinksModal } from '@/components/events/EventLinksModal'
import { OrgSuspendedBanner } from '@/components/admin/OrgSuspendedBanner'
import { Input } from '@/components/ui/input'
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
  useRestoreEvent,
  useTrashedEvents,
  useUpdateEventStatus,
  type EventRow,
} from '@/hooks/use-events'
import { useEventActivationFlow } from '@/hooks/use-event-activation-flow'
import { usePermanentlyDeleteEvent } from '@/hooks/use-data-lifecycle'
import { useOrganization } from '@/hooks/use-organization-settings'
import { useOrganizationId } from '@/hooks/use-organization-id'
import {
  canTransitionEventStatus,
  eventStatusTransitionError,
} from '@/lib/event-lifecycle'
import { brandColorsForEvent, logoForEvent } from '@/lib/live-event'
import { isOrgSuspended } from '@/lib/account-status'
import { supabase } from '@/lib/supabase'
import type { EventStatus } from '@/types/database'

const EVENT_FILTERS: { value: 'all' | EventStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'ready', label: 'Ready' },
  { value: 'demo', label: 'Demo' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

export function AdminEventsPage() {
  const organizationId = useOrganizationId()
  const orgQuery = useOrganization(organizationId)
  const eventsQuery = useEvents(organizationId)
  const deleteEvent = useDeleteEvent(organizationId)
  const updateStatus = useUpdateEventStatus(organizationId)
  const duplicateEvent = useDuplicateEvent(organizationId)
  const trashedEventsQuery = useTrashedEvents(organizationId)
  const restoreEvent = useRestoreEvent(organizationId)
  const permanentlyDeleteEvent = usePermanentlyDeleteEvent(organizationId)
  const navigate = useNavigate()
  const { notify } = useNotification()
  const activation = useEventActivationFlow({
    billingPlan: orgQuery.data?.billing_plan,
    organizationId,
    educationalStatus: orgQuery.data?.educational_status,
    onValidationError: notify,
  })

  const [linksModal, setLinksModal] = useState<EventRow | null>(null)
  const [deleteConfirmEvent, setDeleteConfirmEvent] = useState<EventRow | null>(null)
  const [permanentDeleteConfirmEvent, setPermanentDeleteConfirmEvent] =
    useState<EventRow | null>(null)
  const [view, setView] = useState<'events' | 'bin'>('events')
  const [statusFilter, setStatusFilter] = useState<'all' | EventStatus>('all')
  const [search, setSearch] = useState('')
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Month and Year are derived from the range rather than held separately, so
  // the three controls can never disagree about what is actually filtered.
  const lastDayOfMonth = (year: number, monthIndex: number) =>
    new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()

  const monthValue =
    dateFrom && dateTo && dateFrom.slice(0, 7) === dateTo.slice(0, 7) &&
    dateFrom.endsWith('-01')
      ? dateFrom.slice(0, 7)
      : ''

  const yearValue =
    dateFrom.endsWith('-01-01') && dateTo.endsWith('-12-31') &&
    dateFrom.slice(0, 4) === dateTo.slice(0, 4)
      ? dateFrom.slice(0, 4)
      : ''

  function applyMonth(value: string) {
    if (!value) {
      setDateFrom('')
      setDateTo('')
      return
    }
    const [year, month] = value.split('-').map(Number)
    setDateFrom(`${value}-01`)
    setDateTo(`${value}-${String(lastDayOfMonth(year, month - 1)).padStart(2, '0')}`)
  }

  function applyYear(value: string) {
    if (value.length !== 4) {
      if (!value) {
        setDateFrom('')
        setDateTo('')
      }
      return
    }
    setDateFrom(`${value}-01-01`)
    setDateTo(`${value}-12-31`)
  }

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
      eventId,
      event.status as EventStatus,
      status,
      event.name,
      event.team_count,
      event.activated_at,
      () => updateStatus.mutateAsync({ eventId, status }).then(() => undefined),
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
      eventId,
      event.status as EventStatus,
      newStatus,
      event.name,
      event.team_count,
      event.activated_at,
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

  async function confirmPermanentDelete() {
    if (!permanentDeleteConfirmEvent) return
    try {
      await permanentlyDeleteEvent.mutateAsync(permanentDeleteConfirmEvent.id)
      setPermanentDeleteConfirmEvent(null)
      notify('Event and its uploaded media were permanently deleted.')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not permanently delete event')
    }
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
  const searchQuery = search.trim().toLowerCase()
  const visibleEvents = events.filter((event) => {
    if (statusFilter !== 'all' && event.status !== statusFilter) return false
    if (searchQuery && !event.name.toLowerCase().includes(searchQuery)) return false
    if (!event.event_date) return !dateFrom && !dateTo
    const date = event.event_date.slice(0, 10)
    if (dateFrom && date < dateFrom) return false
    if (dateTo && date > dateTo) return false
    return true
  })
  const suspended = isOrgSuspended(orgQuery.data?.account_status)

  return (
    <AdminPageShell
      title="Events"
      subtitle="Manage your events."
      actions={
        <>
          <NeoButton variant="surface" asChild>
            <Link to="/admin/games">
              Games
            </Link>
          </NeoButton>
          {suspended ? (
            <NeoButton variant="accent" disabled>
              New Event
            </NeoButton>
          ) : (
            <NeoButton variant="accent" asChild>
              <Link to="/admin/events/new" data-tour="new-event-button">
                <IconPlus className="size-3.5.5" />
                Event
              </Link>
            </NeoButton>
          )}
        </>
      }
    >
      <OrgSuspendedBanner accountStatus={orgQuery.data?.account_status} />

      <div className="border-border/70 mb-6 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`h-9 rounded-full border px-4 text-xs font-semibold transition-colors ${view === 'events' && statusFilter === 'all' ? 'border-nm-slate-800 bg-nm-slate-800 text-white dark:border-nm-slate-700 dark:bg-nm-slate-700' : 'border-border bg-card text-muted-foreground hover:border-nm-slate-400 hover:text-foreground'}`}
          onClick={() => {
            setView('events')
            setStatusFilter('all')
          }}
        >
          All
        </button>
        {EVENT_FILTERS.slice(1).map((item) => (
          <button
            key={item.value}
            type="button"
            className={`h-9 rounded-full border px-4 text-xs font-semibold transition-colors ${view === 'events' && statusFilter === item.value ? 'border-nm-slate-800 bg-nm-slate-800 text-white dark:border-nm-slate-700 dark:bg-nm-slate-700' : 'border-border bg-card text-muted-foreground hover:border-nm-slate-400 hover:text-foreground'}`}
            onClick={() => {
              setView('events')
              setStatusFilter(item.value)
            }}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          className={`h-9 rounded-full border px-4 text-xs font-semibold transition-colors ${view === 'bin' ? 'border-nm-slate-800 bg-nm-slate-800 text-white dark:border-nm-slate-700 dark:bg-nm-slate-700' : 'border-border bg-card text-muted-foreground hover:border-nm-slate-400 hover:text-foreground'}`}
          onClick={() => setView('bin')}
        >
          Deleted {trashedEventsQuery.data?.length ? `(${trashedEventsQuery.data.length})` : ''}
        </button>
        </div>
        {view === 'events' ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative min-w-52 flex-1">
              <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5.5 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search events…"
                className="bg-card h-9 pl-8 text-xs"
              />
            </div>
            <div className="relative">
            {/* Always gold, like the Games group selector, with the label
                carrying whether a range is applied. */}
            <NeoButton
              type="button"
              variant="accent"
              onClick={() => setDatePickerOpen((open) => !open)}
            >
              <IconEvents className="size-3.5.5" />
              {dateFrom || dateTo ? 'Date applied' : 'Date'}
            </NeoButton>
            {datePickerOpen ? (
              <div className="border-border bg-card absolute right-0 top-10 z-30 w-72 rounded-lg border p-4 shadow-xl">
                <p className="text-foreground mb-3 text-xs font-semibold uppercase tracking-[0.08em]">Filter by date</p>
                {/* Shortcuts that write the same From/To range the filter
                    already uses, so there is only one filtering path to reason
                    about rather than three competing ones. */}
                <div className="mb-3 space-y-2">
                  <label className="text-muted-foreground block space-y-1 text-xs">
                    <span>Specific date</span>
                    <input
                      className="neo-field w-full text-xs"
                      type="date"
                      value={dateFrom && dateFrom === dateTo ? dateFrom : ''}
                      onChange={(event) => {
                        const day = event.target.value
                        setDateFrom(day)
                        setDateTo(day)
                      }}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-muted-foreground space-y-1 text-xs">
                      <span>Month</span>
                      <input
                        className="neo-field w-full text-xs"
                        type="month"
                        value={monthValue}
                        onChange={(event) => applyMonth(event.target.value)}
                      />
                    </label>
                    <label className="text-muted-foreground space-y-1 text-xs">
                      <span>Year</span>
                      <input
                        className="neo-field w-full text-xs"
                        type="number"
                        min={2000}
                        max={2100}
                        placeholder="2026"
                        value={yearValue}
                        onChange={(event) => applyYear(event.target.value)}
                      />
                    </label>
                  </div>
                </div>
                <p className="text-foreground mb-2 text-xs font-semibold uppercase tracking-[0.08em]">Range</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-muted-foreground space-y-1 text-xs">
                    <span>From</span>
                    <input className="neo-field w-full text-xs" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                  </label>
                  <label className="text-muted-foreground space-y-1 text-xs">
                    <span>To</span>
                    <input className="neo-field w-full text-xs" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                  </label>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <NeoButton type="button" size="sm" variant="ghost" onClick={() => { setDateFrom(''); setDateTo('') }}>Clear</NeoButton>
                  <NeoButton type="button" size="sm" variant="primary" onClick={() => setDatePickerOpen(false)}>Apply</NeoButton>
                </div>
              </div>
            ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {view === 'bin' ? (
        <BinPanel
          items={(trashedEventsQuery.data ?? []).map((e) => ({
            id: e.id,
            name: e.name,
            deletedAt: e.deleted_at!,
          }))}
          emptyLabel="No deleted events."
          restoringId={restoreEvent.isPending ? restoreEvent.variables : undefined}
          deletingId={
            permanentlyDeleteEvent.isPending
              ? permanentlyDeleteEvent.variables
              : undefined
          }
          onRestore={(id) => restoreEvent.mutateAsync(id)}
          onOpen={(id) => navigate(`/admin/events/${id}`)}
          onDeletePermanently={(id) => {
            const event = trashedEventsQuery.data?.find((item) => item.id === id)
            if (event) setPermanentDeleteConfirmEvent(event)
          }}
        />
      ) : eventsQuery.isLoading ? (
        <QueryLoading rows={5} />
      ) : eventsQuery.isError ? (
        <QueryError message={eventsQuery.error.message} />
      ) : visibleEvents.length === 0 ? (
        <Card className="border-border/80 flex flex-col items-center justify-center gap-3 bg-card px-6 py-16 text-center shadow-sm">
          <IconEvents className="text-muted-foreground size-10 opacity-60" />
          <p className="text-foreground font-medium">No events yet</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            {events.length === 0
              ? 'Create an event to schedule team activities and manage live sessions.'
              : 'No events match the selected filters.'}
          </p>
          {suspended ? (
            <NeoButton variant="accent" disabled className="mt-2">
              Create New Event
            </NeoButton>
          ) : (
            <NeoButton variant="accent" asChild className="mt-2">
              <Link to="/admin/events/new">Create New Event</Link>
            </NeoButton>
          )}
        </Card>
      ) : (
        <DraggableEventsGrid
          events={visibleEvents}
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
              Delete <strong className="text-foreground">{deleteConfirmEvent.name}</strong>? It'll move to the Bin and be permanently deleted in 30 days.
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

      {permanentDeleteConfirmEvent ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="permanent-delete-event-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        >
          <div className="bg-card border-border/80 w-full max-w-sm rounded-xl border p-6 shadow-lg">
            <h2
              id="permanent-delete-event-title"
              className="text-foreground mb-2 font-semibold"
            >
              Permanently delete this event?
            </h2>
            <p className="text-muted-foreground mb-5 text-sm">
              <strong className="text-foreground">
                {permanentDeleteConfirmEvent.name}
              </strong>{' '}
              and all of its submissions, team photos, videos, and other event data will be
              removed from Supabase. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={permanentlyDeleteEvent.isPending}
                onClick={() => setPermanentDeleteConfirmEvent(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={permanentlyDeleteEvent.isPending}
                onClick={() => void confirmPermanentDelete()}
              >
                {permanentlyDeleteEvent.isPending ? 'Deleting…' : 'Delete permanently'}
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
          eventSlug={linksModal.slug}
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
