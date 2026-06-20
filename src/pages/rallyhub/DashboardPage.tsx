import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { NeoCard, NeoPageShell } from '@/components/neo-minimal'
import { StatusIndicator, type RallyStatusTone } from '@/components/ui/status-indicator'
import { useExpireOverdueTrials, useRallyHubDashboard } from '@/hooks/use-rallyhub'
import { formatEur } from '@/lib/subscription-plans'
import { cn } from '@/lib/utils'

const STATUS_ORDER = ['active', 'ready', 'demo', 'draft', 'archived'] as const

function formatEventDate(iso: string | null) {
  if (!iso) return 'Date not set'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function RallyHubOverviewPage() {
  const { data, isLoading, isError, error } = useRallyHubDashboard()
  const expireTrials = useExpireOverdueTrials()

  useEffect(() => {
    void expireTrials.mutateAsync().catch(() => {
      // Fire-and-forget; failures are non-critical
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <NeoPageShell
      title="Dashboard"
      subtitle="Platform-wide overview for RallyHub super admins."
    >
      {isLoading ? (
        <QueryLoading rows={4} />
      ) : isError ? (
        <QueryError message={error?.message} />
      ) : (
        <div className="space-y-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Clients" value={data?.clientCount ?? 0} />
            <StatTile label="Active events" value={data?.activeEvents ?? 0} />
            <StatTile label="Upcoming events" value={data?.upcomingEvents ?? 0} />
            <StatTile label="Total events" value={data?.totalEvents ?? 0} />
          </div>

          <section className="space-y-3">
            <h2 className="text-foreground text-lg font-semibold">Revenue</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile
                label="Outstanding"
                value={formatEur(data?.revenue.outstanding ?? 0)}
                hint="Unpaid event invoices"
              />
              <StatTile
                label="Collected"
                value={formatEur(data?.revenue.collected ?? 0)}
                hint="Paid event invoices"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-foreground text-lg font-semibold">Events by status</h2>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((status) => {
                const count = data?.statusBreakdown?.[status] ?? 0
                return (
                  <NeoCard key={status} className="flex items-center gap-2 px-4 py-2">
                    <StatusIndicator status={status} />
                    <span className="text-foreground font-semibold tabular-nums">{count}</span>
                  </NeoCard>
                )
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-foreground text-lg font-semibold">Recent events</h2>
              <Link to="/admin/clients" className="text-muted-foreground text-sm hover:underline">
                View clients
              </Link>
            </div>
            {(data?.recentEvents.length ?? 0) === 0 ? (
              <NeoCard className="px-5 py-8">
                <p className="text-muted-foreground text-sm">No events across clients yet.</p>
              </NeoCard>
            ) : (
              <NeoCard className="overflow-hidden p-0">
                <ul className="divide-border divide-y">
                  {data?.recentEvents.map((event) => (
                    <li
                      key={event.id}
                      className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-foreground font-semibold leading-snug">{event.name}</p>
                        <p className="text-muted-foreground mt-0.5 text-sm">
                          {event.clientName} · {formatEventDate(event.dateISO)}
                        </p>
                      </div>
                      <div className="shrink-0 sm:text-right">
                        <StatusIndicator status={event.status as RallyStatusTone} />
                      </div>
                    </li>
                  ))}
                </ul>
              </NeoCard>
            )}
          </section>
        </div>
      )}
    </NeoPageShell>
  )
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: number | string
  hint?: string
}) {
  return (
    <NeoCard className={cn('p-6', hint ? 'pb-5' : undefined)}>
      <p className="neo-stat-label">{label}</p>
      <p className="neo-stat-value mt-3">{value}</p>
      {hint ? <p className="neo-stat-hint mt-2">{hint}</p> : null}
    </NeoCard>
  )
}
