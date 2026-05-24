import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { AccentButton } from '@/components/admin/AccentButton'
import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { EventForm } from '@/components/events/EventForm'
import { EventLinksPanel } from '@/components/events/EventLinksPanel'
import { EventStatusMenu } from '@/components/events/EventStatusMenu'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import { Card } from '@/components/ui/card'
import {
  useEvent,
  useEventGameIds,
  useUpdateEvent,
  useUpdateEventStatus,
} from '@/hooks/use-events'
import { useGameGroups } from '@/hooks/use-game-groups'
import { useGames } from '@/hooks/use-games'
import { useOrganization } from '@/hooks/use-organization-settings'
import { useOrganizationId } from '@/hooks/use-organization-id'
import {
  emptyEventForm,
  eventToFormValues,
  type EventFormValues,
} from '@/lib/event-form-utils'
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

  const [values, setValues] = useState<EventFormValues>(emptyEventForm)
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          team_count: values.teamCount,
          branding_enabled: values.brandingEnabled,
          logo_url: values.brandingEnabled
            ? values.logoUrl
            : org?.logo_url ?? null,
          brand_colors: values.brandingEnabled
            ? values.brandColors
            : [
                org?.primary_color,
                org?.secondary_color,
                org?.accent_color,
              ].filter((c): c is string => Boolean(c)),
          teams_config: values.teams,
          stages_config: values.stages,
          display_layout: values.displayLayout,
        },
        gameIds: values.selectedGameIds,
      })
      navigate('/admin/events', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  if (!organizationId) {
    return (
      <AdminPageShell title="Edit event" subtitle="Update event details.">
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  const loading =
    eventQuery.isLoading || gameIdsQuery.isLoading || !hydrated

  const eventStatus = (eventQuery.data?.status ?? 'draft') as EventStatus

  return (
    <AdminPageShell
      title="Edit event"
      subtitle="Update event details, teams, games, and stages."
      actions={
        <AccentButton
          type="button"
          disabled={saving || loading}
          onClick={() => void handleSave()}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </AccentButton>
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

          <Card className="border-border/80 mb-8 flex flex-wrap items-center gap-4 bg-card p-4 shadow-sm">
            <span className="text-foreground text-sm font-medium">Event status</span>
            <EventStatusMenu
              status={eventStatus}
              size="default"
              disabled={updateStatus.isPending}
              onSelect={(status) => {
                if (!eventId) return
                void updateStatus.mutateAsync({ eventId, status })
              }}
            />
          </Card>

          <EventForm
            organizationId={organizationId}
            values={values}
            onChange={setValues}
            games={gamesQuery.data ?? []}
            groups={groupsQuery.data ?? []}
            orgDefaults={orgQuery.data ?? null}
          />

          {eventId ? (
            <Card className="border-border/80 mt-8 space-y-4 bg-card p-6 shadow-sm">
              <h2 className="text-foreground text-lg font-semibold">Links</h2>
              <p className="text-muted-foreground text-sm">
                Share these URLs with facilitators, displays, and participants.
              </p>
              <EventLinksPanel eventId={eventId} />
            </Card>
          ) : null}

          <FormSaveFooter
            onSave={() => void handleSave()}
            saving={saving}
            label="Save Changes"
          />
        </>
      )}
    </AdminPageShell>
  )
}
