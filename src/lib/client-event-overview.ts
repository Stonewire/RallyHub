import { normalizeClientPlan } from '@/lib/client-plans'
import { isEventDemoStatus } from '@/lib/event-demo'
import type { Tables } from '@/types/helpers'

export type ClientEventRow = Tables<'events'>

export type ClientEventOverviewGroup = {
  id: 'previous' | 'upcoming' | 'demo' | 'drafts'
  title: string
  events: ClientEventRow[]
}

export function formatClientEventDate(iso: string | null) {
  if (!iso) return 'Date not set'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function isEventInvoicePaid(
  event: Pick<ClientEventRow, 'invoice_paid' | 'invoiced_at'>,
  clientPlan: string | null | undefined,
) {
  if (normalizeClientPlan(clientPlan) === 'partner') return true
  if (event.invoiced_at && event.invoice_paid) return true
  return event.invoice_paid === true
}

function sortByEventDate(events: ClientEventRow[]) {
  return [...events].sort((a, b) => {
    const da = a.event_date ?? ''
    const db = b.event_date ?? ''
    return db.localeCompare(da)
  })
}

export function groupClientEventsForOverview(events: ClientEventRow[]): ClientEventOverviewGroup[] {
  return [
    {
      id: 'upcoming',
      title: 'Upcoming',
      events: sortByEventDate(
        events.filter((e) => e.status === 'ready' || e.status === 'active'),
      ),
    },
    {
      id: 'demo',
      title: 'Demo',
      events: sortByEventDate(events.filter((e) => isEventDemoStatus(e.status))),
    },
    {
      id: 'drafts',
      title: 'Drafts',
      events: sortByEventDate(events.filter((e) => e.status === 'draft')),
    },
    {
      id: 'previous',
      title: 'Previous',
      events: sortByEventDate(events.filter((e) => e.status === 'archived')),
    },
  ]
}
