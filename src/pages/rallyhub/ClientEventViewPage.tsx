import { useMemo } from 'react'
import { useParams } from 'react-router-dom'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { EventForm } from '@/components/events/EventForm'
import { EventLinksPanel } from '@/components/events/EventLinksPanel'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { NeoStatusBadge, type NeoStatusBadgeTone } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { useEvent, useEventGameIds } from '@/hooks/use-events'
import { useGameGroups } from '@/hooks/use-game-groups'
import { useGames } from '@/hooks/use-games'
import { useOrganization } from '@/hooks/use-organization-settings'
import { useRallyHubClient } from '@/hooks/use-rallyhub'
import { eventToFormValues } from '@/lib/event-form-utils'

/**
 * A client's event, exactly as they see it in their own editor, read-only.
 *
 * This renders the real EventForm against the client's organisation inside a
 * disabled fieldset: same cards, same layout, nothing editable and no save.
 * The danger zone, duplicate and status controls do not exist here at all,
 * because showing a disabled destructive control still reads as a threat.
 */
export function RallyHubClientEventViewPage() {
  const { clientId, eventId } = useParams<{ clientId: string; eventId: string }>()
  const eventQuery = useEvent(eventId)
  const gameIdsQuery = useEventGameIds(eventId)
  const gamesQuery = useGames(clientId ?? null)
  const groupsQuery = useGameGroups(clientId ?? null)
  const orgQuery = useOrganization(clientId ?? null)
  const clientQuery = useRallyHubClient(clientId)

  const values = useMemo(
    () =>
      eventQuery.data && gameIdsQuery.data !== undefined
        ? eventToFormValues(eventQuery.data, gameIdsQuery.data)
        : null,
    [eventQuery.data, gameIdsQuery.data],
  )

  const backTo = `/admin/clients/${clientId}?tab=events`
  const clientName = clientQuery.data?.org.name

  if (eventQuery.isLoading || gameIdsQuery.isLoading || !values) {
    return (
      <AdminPageShell title="Event" backTo={backTo} backLabel="Back to client">
        {eventQuery.isError ? (
          <QueryError message={eventQuery.error?.message ?? 'Event not found'} />
        ) : (
          <QueryLoading rows={6} />
        )}
      </AdminPageShell>
    )
  }

  const event = eventQuery.data!

  return (
    <AdminPageShell
      title={event.name}
      subtitle={
        clientName
          ? `${clientName}'s event, shown exactly as they see it. Read-only.`
          : 'Shown exactly as the client sees it. Read-only.'
      }
      backTo={backTo}
      backLabel="Back to client"
      actions={
        <NeoStatusBadge tone={event.status as NeoStatusBadgeTone}>{event.status}</NeoStatusBadge>
      }
    >
      {/* One disabled fieldset around the client's own form: every control is
          visible and none of them write. */}
      <fieldset disabled className="[&_*]:cursor-default">
        <EventForm
          organizationId={clientId!}
          storageKey={event.id}
          values={values}
          onChange={() => {}}
          games={gamesQuery.data ?? []}
          groups={groupsQuery.data ?? []}
          orgDefaults={orgQuery.data ?? null}
        />
      </fieldset>

      <Card className="border-border/80 mt-6 space-y-4 bg-card p-6 shadow-sm">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Event links</h2>
          <p className="text-muted-foreground text-sm">
            The same QR codes and URLs the client hands out.
          </p>
        </div>
        <EventLinksPanel
          eventId={event.id}
          eventName={event.name}
          eventSlug={event.slug}
          organization={
            orgQuery.data
              ? {
                  subdomain: orgQuery.data.subdomain,
                  custom_domain: orgQuery.data.custom_domain,
                }
              : null
          }
          branding={{ eventName: event.name }}
        />
      </Card>
    </AdminPageShell>
  )
}
