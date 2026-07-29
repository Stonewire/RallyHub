import { Clock } from 'lucide-react'
import { Link } from 'react-router-dom'

import { NeoCard } from '@/components/neo-minimal'
import type { RecentEventRow } from '@/hooks/use-dashboard'

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const minutes = Math.round((Date.now() - then) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`

  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

type ActivityFeedProps = {
  events: RecentEventRow[]
  isLoading: boolean
}

/**
 * Recent activity. Backed by recent events, since there is no cross-entity
 * activity log yet.
 */
export function ActivityFeed({ events, isLoading }: ActivityFeedProps) {
  return (
    <NeoCard className="flex h-full flex-col p-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold whitespace-nowrap">Recent Activity</h2>
        <Link
          to="/admin/events"
          className="text-nm-neutral-500 shrink-0 text-xs hover:underline"
        >
          View All
        </Link>
      </div>

      {isLoading ? (
        <p className="text-nm-neutral-500 py-2 text-xs">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-nm-neutral-500 py-2 text-xs">
          No events yet.{' '}
          <Link to="/admin/events/new" className="underline">
            Create your first event
          </Link>
          .
        </p>
      ) : (
        <ul>
          {events.map((event) => (
            <li
              key={event.id}
              className="border-border flex gap-2.5 border-t py-2"
            >
              <span className="bg-nm-yellow/20 text-nm-charcoal flex size-[30px] shrink-0 items-center justify-center rounded-full">
                <Clock className="size-3.5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/admin/events/${event.id}`}
                  className="block truncate text-sm hover:underline"
                >
                  {event.name}
                </Link>
                <p className="text-nm-neutral-500 text-xs">
                  {relativeTime(event.dateISO)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </NeoCard>
  )
}
