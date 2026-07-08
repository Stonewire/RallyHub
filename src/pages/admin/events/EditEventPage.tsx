import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'

import { NeoButton } from '@/components/neo-minimal'
import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { EventActivityLog } from '@/components/admin/EventActivityLog'
import { EventForm } from '@/components/events/EventForm'
import { EventLinksPanel } from '@/components/events/EventLinksPanel'
import { EventResetConfirmDialog } from '@/components/events/EventResetConfirmDialog'
import { EventStatusMenu } from '@/components/events/EventStatusMenu'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useNotification } from '@/contexts/notification-context'
import {
  useDuplicateEvent,
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
import { downloadEventPackage } from '@/lib/event-export'
import { capTeamCountForEventStatus, maxTeamCountForEventStatus } from '@/lib/event-demo'
import { isEventActivated, canResetEventData } from '@/lib/event-lifecycle'
import { brandColorsForEvent, brandColorsFromOrg, logoForEvent } from '@/lib/live-event'
import type { EventStatus } from '@/types/database'

export function AdminEventEditPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const organizationId = useOrganizationId()
  const orgQuery = useOrganization(organizationId)
  const gamesQuery = useGames(organizationId)
  const groupsQuery = useGameGroups(organizationId)
  const eventQuery = useEvent(eventId)
  const gameIdsQuery = useEventGameIds(eventId)
  const updateEvent = useUpdateEvent(organizationId)
  const updateStatus = useUpdateEventStatus(organizationId)
  const duplicateEvent = useDuplicateEvent(organizationId)
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
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'settings' | 'log'>('settings')

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

  // eslint-disable-next-line react-hooks/refs -- baselineRef is only ever set inside the hydrate effect above; comparing it during render is the intended unsaved-changes check
  const dirty = hydrated && JSON.stringify(values) !== baselineRef.current

  // #15: warn before leaving the editor with unsaved changes.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !bypassBlockRef.current &&
      currentLocation.pathname !== nextLocation.pathname,
  )

  async function handleSave(onSaved?: () => void) {
    if (!organizationId || !eventId || !values.name.trim()) {
      setError('Event name is required.')
      return
    }
    const nonBreak = values.stages.filter((s) => s.type !== 'break')
    if (nonBreak.length === 0) {
      setError('Add at least one non-break stage.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const org = orgQuery.data
      await updateEvent.mutateAsync({
        eventId,
        event: {
          name: values.name.trim(),
          event_date: values.eventDate
            ? new Date(values.eventDate).toISOString()
            : null,
          team_count: capTeamCountForEventStatus(values.teamCount, eventStatus),
          branding_enabled: values.brandingEnabled,
          logo_url: values.brandingEnabled
            ? values.logoUrl
            : org?.logo_url ?? null,
          brand_colors: values.brandingEnabled
            ? values.brandColors
            : brandColorsFromOrg(org),
          teams_config: values.teams,
          stages_config: values.stages,
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
      else navigate('/admin/events', { replace: true })
    } catch (err) {
      const message = formatSupabaseError(err)
      logSupabaseFailure('AdminEventEditPage.handleSave', err)
      setError(message)
      notify(message)
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
      navigate(`/admin/events/${copy.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duplicate failed')
    }
  }

  if (!organizationId) {
    return (
      <AdminPageShell
        title="Edit event"
        subtitle="Update event details."
        backTo="/admin/events"
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

  return (
    <AdminPageShell
      title={isArchived ? 'View event' : 'Edit event'}
      subtitle={
        isArchived
          ? 'Archived event — view only. Duplicate it to run the setup again.'
          : 'Update event details, teams, games, and stages.'
      }
      backTo="/admin/events"
      backLabel="Back to events"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {!isArchived && (
            <EventStatusMenu
              status={eventStatus}
              invoicedAt={eventQuery.data?.invoiced_at}
              size="default"
              disabled={
                updateStatus.isPending || activation.confirmingActivation || loading
              }
              onSelect={(status) => {
                if (!eventId || !eventQuery.data) return
                activation.requestStatusChange(
                  eventStatus,
                  status,
                  eventQuery.data.name,
                  eventQuery.data.invoiced_at,
                  () => updateStatus.mutateAsync({ eventId, status }),
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
            {(['settings', 'log'] as const).map((tab) => (
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-foreground text-lg font-semibold">Event links</h2>
                      <p className="text-muted-foreground text-sm">
                        QR codes and URLs for facilitator, display, and team join.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={downloading}
                      onClick={() => {
                        setDownloading(true)
                        void downloadEventPackage(eventId).finally(() =>
                          setDownloading(false),
                        )
                      }}
                    >
                      {downloading ? 'Preparing…' : 'Download media & PDF'}
                    </Button>
                  </div>
                  <EventLinksPanel
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

              {resetAllowed && !isArchived ? (
                <Card className="border-border/80 mt-8 space-y-4 bg-card p-6 shadow-sm">
                  <div>
                    <h2 className="text-foreground text-lg font-semibold">Reset event data</h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Clear all teams, submissions, scores, chat, and live progress so you can run a
                      fresh rehearsal. Event games, stages, and branding are kept.
                    </p>
                  </div>
                  <NeoButton
                    type="button"
                    variant="destructive"
                    disabled={resetEventDataMutation.isPending || loading}
                    onClick={() => setResetDialogOpen(true)}
                  >
                    Reset event data
                  </NeoButton>
                </Card>
              ) : null}

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

          {blocker.state === 'blocked' ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <Card className="border-border/80 w-full max-w-sm space-y-4 bg-card p-6 shadow-lg">
                <div className="space-y-1">
                  <h3 className="text-foreground font-semibold">Unsaved changes</h3>
                  <p className="text-muted-foreground text-sm">
                    You have unsaved changes to this event. Save them before leaving?
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <NeoButton variant="surface" onClick={() => blocker.reset?.()}>
                    Cancel
                  </NeoButton>
                  <NeoButton
                    variant="surface"
                    onClick={() => blocker.proceed?.()}
                  >
                    Don't save
                  </NeoButton>
                  <NeoButton
                    variant="primary"
                    disabled={saving}
                    onClick={() => void handleSave(() => blocker.proceed?.())}
                  >
                    {saving ? 'Saving…' : 'Save & leave'}
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
