import { useMemo, useState } from 'react'

import {
  CollapsibleSection,
  loadCollapsedState,
  saveCollapsedState,
} from '@/components/admin/CollapsibleSection'
import { ClientEventOverviewCard } from '@/components/rallyhub/ClientEventOverviewCard'
import { Card } from '@/components/ui/card'
import {
  groupClientEventsForOverview,
  type ClientEventRow,
} from '@/lib/client-event-overview'

const CLIENT_EVENTS_COLLAPSED_STORAGE_KEY = 'rallyhub-client-events-collapsed-v1'

type ClientEventsOverviewProps = {
  events: ClientEventRow[]
  clientPlan: string | null | undefined
}

export function ClientEventsOverview({ events, clientPlan }: ClientEventsOverviewProps) {
  const groups = useMemo(() => groupClientEventsForOverview(events), [events])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    loadCollapsedState(CLIENT_EVENTS_COLLAPSED_STORAGE_KEY),
  )

  function toggleGroup(id: string) {
    setCollapsed((current) => {
      const next = { ...current, [id]: !current[id] }
      saveCollapsedState(next, CLIENT_EVENTS_COLLAPSED_STORAGE_KEY)
      return next
    })
  }

  return (
    <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
      <div>
        <h3 className="text-foreground font-semibold">Events</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Read-only overview of this client&apos;s events.
        </p>
      </div>

      {events.length === 0 ? (
        <p className="text-muted-foreground text-sm">No events yet.</p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <CollapsibleSection
              key={group.id}
              id={`client-events-${group.id}`}
              title={group.title}
              count={group.events.length}
              collapsed={Boolean(collapsed[group.id])}
              onToggle={() => toggleGroup(group.id)}
            >
              {group.events.length === 0 ? (
                <p className="text-muted-foreground py-2 text-xs">
                  No {group.title.toLowerCase()} events.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.events.map((event) => (
                    <ClientEventOverviewCard
                      key={event.id}
                      event={event}
                      clientPlan={clientPlan}
                    />
                  ))}
                </div>
              )}
            </CollapsibleSection>
          ))}
        </div>
      )}
    </Card>
  )
}
