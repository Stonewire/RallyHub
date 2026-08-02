import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { NeoCard, NeoStatusBadge, type NeoStatusBadgeTone } from '@/components/neo-minimal'
import { useExpireOverdueTrials, useRallyHubDashboard } from '@/hooks/use-rallyhub'
import { formatEur } from '@/lib/subscription-plans'

const STATUS_ORDER = ['active', 'ready', 'demo', 'draft', 'archived'] as const

function relativeTime(iso: string | null): string {
  if (!iso) return 'Date not set'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const minutes = Math.round((Date.now() - then) / 60000)
  if (Math.abs(minutes) < 60) {
    if (minutes < 1 && minutes > -1) return 'now'
    return minutes > 0 ? `${minutes}m ago` : `in ${-minutes}m`
  }
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return hours > 0 ? `${hours}h ago` : `in ${-hours}h`
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return days > 0 ? `${days}d ago` : `in ${-days}d`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/**
 * Platform overview, laid out exactly like the client Overview: stat tiles on
 * the left, the tall reference panel on the right, activity underneath. Same
 * grid, same cards, different facts.
 */
export function RallyHubOverviewPage() {
  const { data, isLoading, isError, error } = useRallyHubDashboard()
  const expireTrials = useExpireOverdueTrials()

  useEffect(() => {
    void expireTrials.mutateAsync().catch(() => {
      // Fire-and-forget; failures are non-critical
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stats = [
    { label: 'Clients', value: data?.clientCount, to: '/admin/clients' },
    { label: 'Live Now', value: data?.activeEvents },
    { label: 'Upcoming Events', value: data?.upcomingEvents },
    { label: 'Total Events', value: data?.totalEvents },
  ]

  return (
    <div className="px-6 py-8 lg:px-8">
      <h1 className="mb-1 text-3xl font-bold">Overview</h1>
      <p className="text-nm-neutral-500 mb-6 text-sm">
        Welcome back. Here's what's happening across RallyHub today.
      </p>

      {isLoading ? (
        <QueryLoading rows={4} />
      ) : isError ? (
        <QueryError message={error?.message} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_minmax(0,2.2fr)]">
          {stats.map((stat) => (
            <div key={stat.label} className="xl:col-span-1">
              <PlatformStatCard label={stat.label} value={stat.value} to={stat.to} />
            </div>
          ))}

          {/* Reference, not interaction: money owed and where events stand. */}
          <div className="xl:col-start-3 xl:row-span-2 xl:row-start-1">
            <NeoCard className="flex h-full flex-col p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold whitespace-nowrap">Revenue</h2>
                <Link
                  to="/admin/payments"
                  className="text-nm-neutral-500 shrink-0 text-xs hover:underline"
                >
                  View Payments
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-nm-neutral-500 mb-1 text-[10px] font-semibold tracking-wider uppercase">
                    Outstanding
                  </p>
                  <p className="text-3xl font-bold tabular-nums">
                    {formatEur(data?.revenue.outstanding ?? 0)}
                  </p>
                  <p className="text-nm-neutral-500 mt-1 text-xs">Unpaid event invoices</p>
                </div>
                <div>
                  <p className="text-nm-neutral-500 mb-1 text-[10px] font-semibold tracking-wider uppercase">
                    Collected
                  </p>
                  <p className="text-3xl font-bold tabular-nums">
                    {formatEur(data?.revenue.collected ?? 0)}
                  </p>
                  <p className="text-nm-neutral-500 mt-1 text-xs">Paid event invoices</p>
                </div>
              </div>

              <div className="border-border/70 mt-4 border-t pt-4">
                <p className="text-nm-neutral-500 mb-2 text-[10px] font-semibold tracking-wider uppercase">
                  Events by status
                </p>
                <ul className="space-y-1.5">
                  {STATUS_ORDER.map((status) => (
                    <li key={status} className="flex items-center justify-between gap-3">
                      <NeoStatusBadge tone={status}>{status}</NeoStatusBadge>
                      <span className="text-foreground text-sm font-bold tabular-nums">
                        {data?.statusBreakdown?.[status] ?? 0}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </NeoCard>
          </div>

          <div className="xl:col-span-2 xl:col-start-1">
            <NeoCard className="flex h-full flex-col p-4">
              <div className="mb-1 flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold whitespace-nowrap">Recent Events</h2>
                <Link
                  to="/admin/clients"
                  className="text-nm-neutral-500 shrink-0 text-xs hover:underline"
                >
                  View Clients
                </Link>
              </div>
              {(data?.recentEvents.length ?? 0) === 0 ? (
                <p className="text-nm-neutral-500 py-2 text-xs">No events across clients yet.</p>
              ) : (
                <ul className="divide-border/60 divide-y">
                  {data?.recentEvents.map((event) => (
                    <li key={event.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate text-sm font-semibold">
                          {event.name}
                        </p>
                        <p className="text-nm-neutral-500 mt-0.5 text-xs">
                          {event.clientName} · {relativeTime(event.dateISO)}
                        </p>
                      </div>
                      <NeoStatusBadge tone={event.status as NeoStatusBadgeTone}>
                        {event.status}
                      </NeoStatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </NeoCard>
          </div>
        </div>
      )}
    </div>
  )
}

/** The client Overview's stat tile, minus the link when there is nowhere to go. */
function PlatformStatCard({
  label,
  value,
  to,
}: {
  label: string
  value: number | undefined
  to?: string
}) {
  const card = (
    <NeoCard interactive={Boolean(to)} className="h-full p-4">
      <p className="text-nm-neutral-500 mb-1 text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </p>
      <p className="text-4xl font-bold tabular-nums">{value ?? 0}</p>
    </NeoCard>
  )
  return to ? <Link to={to}>{card}</Link> : card
}
