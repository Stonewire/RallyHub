import { useMemo, useState } from 'react'

import {
  CollapsibleSection,
  loadCollapsedState,
  saveCollapsedState,
} from '@/components/admin/CollapsibleSection'
import { ClientEventOverviewCard } from '@/components/rallyhub/ClientEventOverviewCard'
import {
  groupClientEventsForOverview,
  type ClientEventRow,
} from '@/lib/client-event-overview'

const CLIENT_EVENTS_COLLAPSED_STORAGE_KEY = 'rallyhub-client-events-collapsed-v1'

type ClientEventsOverviewProps = {
  events: ClientEventRow[]
  clientPlan: string | null | undefined
  hideInvoiceState?: boolean
  clientId?: string
}

export function ClientEventsOverview({
  events,
  clientPlan,
  hideInvoiceState,
  clientId,
}: ClientEventsOverviewProps) {
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

  // Groups sit straight on the page, as on the client's own Events screen,
  // rather than boxed inside one giant card.
  return (
    <div className="space-y-5">
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
                <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">
                  {group.events.map((event) => (
                    <ClientEventOverviewCard
                      key={event.id}
                      event={event}
                      clientPlan={clientPlan}
                      hideInvoiceState={hideInvoiceState}
                      clientId={clientId}
                    />
                  ))}
                </div>
              )}
            </CollapsibleSection>
          ))}
        </div>
      )}
    </div>
  )
}
