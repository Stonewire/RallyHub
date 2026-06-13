import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { NeoButton } from '@/components/neo-minimal'
import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
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
  })

  const [values, setValues] = useState<EventFormValues>(emptyEventForm)
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)

  useEffect(() => {
    if (eventQuery.data && gameIdsQuery.data !== undefined && !hydrated) {
      setValues(eventToFormValues(eventQuery.data, gameIdsQuery.data))
      setHydrated(true)
    }
  }, [eventQuery.data, gameIdsQuery.data, hydrated])

  async function handleSave() {
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
      navigate('/admin/events', { replace: true })
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
      title="Edit event"
      subtitle="Update event details, teams, games, and stages."
      backTo="/admin/events"
      backLabel="Back to events"
      actions={
        <div className="flex flex-wrap items-center gap-2">
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
          <NeoButton
            type="button"
            variant="surface"
            disabled={duplicateEvent.isPending || loading}
            onClick={() => void handleDuplicate()}
          >
            {duplicateEvent.isPending ? 'Duplicating…' : 'Duplicate event'}
          </NeoButton>
          <NeoButton
            type="button"
            variant="primary"
            disabled={saving || loading}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </NeoButton>
        </div>
      }
    >
      {eventQuery.isError ? (
        <QueryError message={eventQuery.error.message} />
      ) : loading ? (
        <QueryLoading rows={6} />
      ) : (
        <>
          {error ? (
            <p className="text-destructive mb-4 text-sm" role="alert">
              {error}
            </p>
          ) : null}

          {activated ? (
            <Card className="border-border/80 mb-6 bg-muted/30 p-4 text-sm">
              <p className="text-foreground font-medium">This event has been activated</p>
              <p className="text-muted-foreground mt-1">
                Billed events can only be archived. To run the same setup again, duplicate
                this event to create a fresh copy that can be activated separately.
              </p>
            </Card>
          ) : null}

          <EventForm
            organizationId={organizationId}
            values={values}
            onChange={setValues}
            games={gamesQuery.data ?? []}
            groups={groupsQuery.data ?? []}
            orgDefaults={orgQuery.data ?? null}
            maxTeamCount={maxTeamCountForEventStatus(eventStatus)}
          />

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

          {resetAllowed ? (
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

          <FormSaveFooter
            onSave={() => void handleSave()}
            saving={saving}
            label="Save Changes"
          />

          <activation.ActivationDialog />

          {resetDialogOpen && eventQuery.data ? (
            <EventResetConfirmDialog
              eventName={eventQuery.data.name}
              confirming={resetEventDataMutation.isPending}
              onCancel={() => setResetDialogOpen(false)}
              onConfirm={() => void handleResetEventData()}
            />
          ) : null}
        </>
      )}
    </AdminPageShell>
  )
}
