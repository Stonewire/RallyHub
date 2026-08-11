import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'

import { useOptionalTenant } from '@/contexts/tenant-context'
import { orgPath } from '@/lib/org-path'
import { NeoButton } from '@/components/neo-minimal'
import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { EventActivityLog } from '@/components/admin/EventActivityLog'
import { EventTasksPanel } from '@/components/events/EventTasksPanel'
import { DangerZone } from '@/components/admin/DangerZone'
import { EventForm } from '@/components/events/EventForm'
import { EventLinksPanel, EventQrDownloadButton } from '@/components/events/EventLinksPanel'
import { EventResetConfirmDialog } from '@/components/events/EventResetConfirmDialog'
import { EventStatusMenu } from '@/components/events/EventStatusMenu'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import { Card } from '@/components/ui/card'
import { useNotification } from '@/contexts/notification-context'
import {
  useDuplicateEvent,
  useDeleteEvent,
  useEvent,
  useEventGameIds,
  useResetEventData,
  useUpdateEvent,
  useUpdateEventStatus,
} from '@/hooks/use-events'
import { useEventActivationFlow } from '@/hooks/use-event-activation-flow'
import { useGameGroups } from '@/hooks/use-game-groups'
import { useGames } from '@/hooks/use-games'
import { useOrganization } from '@/hooks/use-organization-settings'
import { useOrganizationId } from '@/hooks/use-organization-id'
import {
  collectEventGameIds,
  emptyEventForm,
  eventToFormValues,
  type EventFormValues,
} from '@/lib/event-form-utils'
import { formatSupabaseError, logSupabaseFailure } from '@/lib/supabase-errors'
import { publishLiveBundleReload } from '@/lib/live-broadcast'
import { downloadEventPackage, formatMb } from '@/lib/event-export'
import { capTeamCountForEventStatus, maxTeamCountForEventStatus } from '@/lib/event-demo'
import { isEventActivated, canResetEventData } from '@/lib/event-lifecycle'
import { brandColorsForEvent, brandColorsFromOrg, logoForEvent } from '@/lib/live-event'
import type { EventStatus } from '@/types/database'

export function AdminEventEditPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const clientSlug = useOptionalTenant()?.tenantOrg?.subdomain ?? null
  const organizationId = useOrganizationId()
  const orgQuery = useOrganization(organizationId)
  const gamesQuery = useGames(organizationId)
  const groupsQuery = useGameGroups(organizationId)
  const eventQuery = useEvent(eventId)
  const gameIdsQuery = useEventGameIds(eventId)
  const updateEvent = useUpdateEvent(organizationId)
  const updateStatus = useUpdateEventStatus(organizationId)
  const duplicateEvent = useDuplicateEvent(organizationId)
  const deleteEvent = useDeleteEvent(organizationId)
  const resetEventDataMutation = useResetEventData(organizationId)
  const { notify } = useNotification()
  const activation = useEventActivationFlow({
    billingPlan: orgQuery.data?.billing_plan,
    organizationId,
    educationalStatus: orgQuery.data?.educational_status,
    onValidationError: notify,
  })

  const [values, setValues] = useState<EventFormValues>(emptyEventForm)
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  // Large events take minutes to export; a silent disabled button reads as
  // broken (562 MB client event, 31 Jul 2026), so progress is shown throughout.
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'settings' | 'tasks' | 'log'>('settings')

  // Baseline snapshot of the form as loaded, for unsaved-change detection (#15).
  const baselineRef = useRef<string>('')
  const bypassBlockRef = useRef(false)

  useEffect(() => {
    if (eventQuery.data && gameIdsQuery.data !== undefined && !hydrated) {
      const initial = eventToFormValues(eventQuery.data, gameIdsQuery.data)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrates the local editable form from fetched data, once
      setValues(initial)
      baselineRef.current = JSON.stringify(initial)
      setHydrated(true)
    }
  }, [eventQuery.data, gameIdsQuery.data, hydrated])

   
  const dirty = hydrated && JSON.stringify(values) !== baselineRef.current

  // Leaving with unsaved changes SAVES them (Rumen, 9 Aug): the device back
  // button/gesture means "save and go back", not "ask me questions".
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !bypassBlockRef.current &&
      currentLocation.pathname !== nextLocation.pathname,
  )
  const autoSavingRef = useRef(false)
  useEffect(() => {
    if (blocker.state !== 'blocked' || autoSavingRef.current) return
    autoSavingRef.current = true
    void (async () => {
      const ok = await handleSave(() => blocker.proceed?.())
      if (!ok) blocker.reset?.()
      autoSavingRef.current = false
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per blocked transition; handleSave identity churns every render
  }, [blocker.state])

  async function handleSave(onSaved?: () => void): Promise<boolean> {
    if (!organizationId || !eventId || !values.name.trim()) {
      setError('Event name is required.')
      return false
    }
    const gameStages = values.stages.filter(
      (s) => s.type === 'open' || s.type === 'quiz' || s.type === 'bingo',
    )
    if (gameStages.length === 0) {
      setError('Add at least one game stage.')
      return false
    }

    setSaving(true)
    setError(null)
    try {
      const org = orgQuery.data
      await updateEvent.mutateAsync({
        eventId,
        event: {
          name: values.name.trim(),
          location: values.location.trim() || null,
          event_date: values.eventDate
            ? new Date(values.eventDate).toISOString()
            : null,
          team_count: capTeamCountForEventStatus(values.teamCount, eventStatus),
          branding_enabled: values.brandingEnabled,
          inventory_enabled: values.inventoryEnabled,
          logo_url: values.brandingEnabled
            ? values.logoUrl
            : org?.logo_url ?? null,
          brand_colors: values.brandingEnabled
            ? values.brandColors
            : brandColorsFromOrg(org),
          teams_config: values.teams,
          stages_config: values.stages,
          store_config: values.store,
          display_layout: values.displayLayout,
          display_text_color: values.displayTextColor,
        },
        gameIds: collectEventGameIds(values.selectedGameIds, values.stages),
      })
      // Push a live reload so any player/display already on this event picks up
      // new/removed games without a manual refresh.
      void publishLiveBundleReload(eventId)
      baselineRef.current = JSON.stringify(values)
      bypassBlockRef.current = true
      if (onSaved) onSaved()
      else navigate(orgPath(clientSlug, '/admin/events'), { replace: true })
      return true
    } catch (err) {
      const message = formatSupabaseError(err)
      logSupabaseFailure('AdminEventEditPage.handleSave', err)
      setError(message)
      notify(message)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleDuplicate() {
    if (!eventQuery.data || !gameIdsQuery.data) return
    setError(null)
    try {
      const copy = await duplicateEvent.mutateAsync({
        source: eventQuery.data,
        gameIds: gameIdsQuery.data,
      })
      navigate(orgPath(clientSlug, `/admin/events/${copy.id}`), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duplicate failed')
    }
  }

  if (!organizationId) {
    return (
      <AdminPageShell
        title="Edit event"
        subtitle="Update event details."
        backTo={orgPath(clientSlug, '/admin/events')}
        backLabel="Back to events"
      >
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  const loading =
    eventQuery.isLoading || gameIdsQuery.isLoading || !hydrated

  const eventStatus = (eventQuery.data?.status ?? 'draft') as EventStatus
  const isArchived = eventStatus === 'archived'
  const activated = eventQuery.data ? isEventActivated(eventQuery.data) : false
  const resetAllowed = canResetEventData(eventStatus)

  async function handleResetEventData() {
    if (!eventId) return
    try {
      await resetEventDataMutation.mutateAsync(eventId)
      setResetDialogOpen(false)
      notify('Event data reset — teams and live progress cleared')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not reset event data')
    }
  }

  async function handleDeleteEvent() {
    if (!eventId) return
    try {
      await deleteEvent.mutateAsync(eventId)
      notify('Event moved to Deleted events.')
      navigate(orgPath(clientSlug, '/admin/events'), { replace: true })
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete event')
    }
  }

  return (
    <AdminPageShell
      title={isArchived ? 'View event' : 'Edit event'}
      subtitle={
        isArchived
          ? 'Archived event — view only. Duplicate it to run the setup again.'
          : 'Update event details, teams, games, and stages.'
      }
      backTo={orgPath(clientSlug, '/admin/events')}
      backLabel="Back to events"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {!isArchived && (
            <EventStatusMenu
              status={eventStatus}
              activatedAt={eventQuery.data?.activated_at}
              size="default"
              disabled={
                updateStatus.isPending || activation.confirmingActivation || loading
              }
              onSelect={(status) => {
                if (!eventId || !eventQuery.data) return
                activation.requestStatusChange(
                  eventId,
                  eventStatus,
                  status,
                  eventQuery.data.name,
                  eventQuery.data.team_count,
                  eventQuery.data.activated_at,
                  () => updateStatus.mutateAsync({ eventId, status }).then(() => undefined),
                )
              }}
            />
          )}
          <NeoButton
            type="button"
            variant="surface"
            disabled={duplicateEvent.isPending || loading}
            onClick={() => void handleDuplicate()}
          >
            {duplicateEvent.isPending ? 'Duplicating…' : 'Duplicate event'}
          </NeoButton>
          {!isArchived && (
            <NeoButton
              type="button"
              variant="primary"
              disabled={saving || loading}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </NeoButton>
          )}
        </div>
      }
    >
      {eventQuery.isError ? (
        <QueryError message={eventQuery.error.message} />
      ) : loading ? (
        <QueryLoading rows={6} />
      ) : (
        <>
          <div className="mb-6 flex gap-1 border-b border-border/60">
            {(['settings', 'tasks', 'log'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'settings' && (
            <>
              {isArchived ? (
                <Card className="border-border/80 mb-6 bg-muted/30 p-4 text-sm">
                  <p className="text-foreground font-medium">Archived — read only</p>
                  <p className="text-muted-foreground mt-1">
                    This event is archived and cannot be edited. Use "Duplicate event" to create
                    a fresh copy with the same setup.
                  </p>
                </Card>
              ) : activated ? (
                <Card className="border-border/80 mb-6 bg-muted/30 p-4 text-sm">
                  <p className="text-foreground font-medium">This event has been activated</p>
                  <p className="text-muted-foreground mt-1">
                    Billed events can only be archived. To run the same setup again, duplicate
                    this event to create a fresh copy that can be activated separately.
                  </p>
                </Card>
              ) : null}

              {error ? (
                <p className="text-destructive mb-4 text-sm" role="alert">
                  {error}
                </p>
              ) : null}

              <fieldset disabled={isArchived} className="contents">
                <EventForm
                  organizationId={organizationId}
                  storageKey={eventId}
                  values={values}
                  onChange={setValues}
                  games={gamesQuery.data ?? []}
                  groups={groupsQuery.data ?? []}
                  orgDefaults={orgQuery.data ?? null}
                  maxTeamCount={maxTeamCountForEventStatus(eventStatus)}
                />
              </fieldset>

              {eventId && eventQuery.data ? (
                <Card className="border-border/80 mt-8 space-y-4 bg-card p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-foreground text-lg font-semibold">Event links</h2>
                      <p className="text-muted-foreground text-sm">
                        QR codes and URLs for facilitator, display, and team join.
                      </p>
                    </div>
                    {/* Top right and yellow: this is the one thing an organiser
                        takes off this card and into the room. */}
                    <EventQrDownloadButton
                      eventId={eventId}
                      eventName={eventQuery.data.name}
                      eventSlug={eventQuery.data.slug}
                      organization={
                        orgQuery.data
                          ? {
                              subdomain: orgQuery.data.subdomain,
                              custom_domain: orgQuery.data.custom_domain,
                            }
                          : null
                      }
                      branding={{ eventName: eventQuery.data.name }}
                    />
                  </div>
                  <EventLinksPanel
                    hideDownloadAll
                    eventId={eventId}
                    eventName={eventQuery.data.name}
                    eventSlug={eventQuery.data.slug}
                    organization={
                      orgQuery.data
                        ? {
                            subdomain: orgQuery.data.subdomain,
                            custom_domain: orgQuery.data.custom_domain,
                          }
                        : null
                    }
                    branding={{
                      eventName: eventQuery.data.name,
                      logoUrl: logoForEvent(eventQuery.data, orgQuery.data ?? null),
                      primaryColor: brandColorsForEvent(
                        eventQuery.data,
                        orgQuery.data ?? null,
                      )[0],
                      accentColor: brandColorsForEvent(
                        eventQuery.data,
                        orgQuery.data ?? null,
                      )[2],
                    }}
                  />
                </Card>
              ) : null}

              <div className="mt-8">
                <DangerZone
                  rows={[
                    {
                      id: 'download-event-files',
                      label: 'Download all event files',
                      description: downloadStatus ? (
                        <span aria-live="polite">{downloadStatus}</span>
                      ) : (
                        'Export the event package, uploaded media, and QR-code PDF.'
                      ),
                      action: (
                        // Large events take minutes to export; a silent disabled
                        // button reads as broken (562 MB client event, 31 Jul
                        // 2026), so progress is reported throughout.
                        <NeoButton
                          type="button"
                          variant="surface"
                          disabled={downloading}
                          onClick={() => {
                            setDownloading(true)
                            setDownloadStatus(null)
                            setError(null)
                            downloadEventPackage(
                              eventId!,
                              eventQuery.data?.name ?? 'event',
                              (p) =>
                                setDownloadStatus(
                                  p.phase === 'downloading'
                                    ? `Downloading ${p.done} of ${p.total} files (${formatMb(p.bytes)})`
                                    : `Saving archive… ${p.done}%`,
                                ),
                            )
                              .then((result) => {
                                if (!result.saved) {
                                  setDownloadStatus(null)
                                  return
                                }
                                setDownloadStatus(
                                  result.missing.length > 0
                                    ? `Saved, but ${result.missing.length} file(s) could not be downloaded, see MISSING-FILES.txt in the archive`
                                    : 'Saved',
                                )
                              })
                              .catch((err: unknown) => {
                                setDownloadStatus(null)
                                setError(
                                  err instanceof Error
                                    ? `Export failed: ${err.message}`
                                    : 'Export failed',
                                )
                              })
                              .finally(() => setDownloading(false))
                          }}
                        >
                          {downloading ? 'Exporting…' : 'Download'}
                        </NeoButton>
                      ),
                    },
                    ...(resetAllowed && !isArchived
                      ? [{
                          id: 'reset-event-data',
                          label: 'Reset event data',
                          description: 'Clear teams, submissions, scores, chat, and live progress while keeping games, stages, and branding.',
                          action: (
                            <NeoButton
                              type="button"
                              variant="destructive"
                              disabled={resetEventDataMutation.isPending || loading}
                              onClick={() => setResetDialogOpen(true)}
                            >
                              Reset
                            </NeoButton>
                          ),
                        }]
                      : []),
                    {
                      id: 'delete-event',
                      label: 'Delete this event',
                      description: 'Move this event to Deleted events. It can be restored before permanent removal.',
                      action: (
                        <NeoButton type="button" variant="destructive" disabled={deleteEvent.isPending} onClick={() => setDeleteDialogOpen(true)}>
                          Delete
                        </NeoButton>
                      ),
                    },
                  ]}
                />
              </div>

              {!isArchived && (
                <FormSaveFooter
                  onSave={() => void handleSave()}
                  saving={saving}
                  label="Save Changes"
                  dirty={dirty}
                />
              )}
            </>
          )}

          {activeTab === 'tasks' && (
            <>
              {eventId ? (
                <EventTasksPanel eventId={eventId} organizationId={organizationId} />
              ) : null}
            </>
          )}

          {activeTab === 'log' && (
            <>{eventId ? <EventActivityLog eventId={eventId} /> : null}</>
          )}

          <activation.ActivationDialog />

          {resetDialogOpen && eventQuery.data ? (
            <EventResetConfirmDialog
              eventName={eventQuery.data.name}
              confirming={resetEventDataMutation.isPending}
              onCancel={() => setResetDialogOpen(false)}
              onConfirm={() => void handleResetEventData()}
            />
          ) : null}

          {deleteDialogOpen && eventQuery.data ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <Card className="border-nm-slate-800 w-full max-w-sm space-y-4 border-2 bg-card p-6 shadow-xl">
                <div>
                  <h3 className="text-foreground font-semibold">Delete this event?</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {eventQuery.data.name} will move to Deleted events and can be restored before permanent removal.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <NeoButton type="button" variant="surface" disabled={deleteEvent.isPending} onClick={() => setDeleteDialogOpen(false)}>Cancel</NeoButton>
                  <NeoButton type="button" variant="destructive" disabled={deleteEvent.isPending} onClick={() => void handleDeleteEvent()}>
                    {deleteEvent.isPending ? 'Deleting…' : 'Delete event'}
                  </NeoButton>
                </div>
              </Card>
            </div>
          ) : null}

        </>
      )}
    </AdminPageShell>
  )
}
