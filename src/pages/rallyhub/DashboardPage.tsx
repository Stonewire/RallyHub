import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { IconBilling, IconBolt, IconEvents, IconLive, IconOrganisation } from '@/components/icons'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NeoButton } from '@/components/neo-minimal'
import { StatusIndicator, type RallyStatusTone } from '@/components/ui/status-indicator'
import { useExpireOverdueTrials, useRallyHubDashboard } from '@/hooks/use-rallyhub'
import { formatEur } from '@/lib/subscription-plans'

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
    <AdminPageShell
      title="Dashboard"
      subtitle="Platform-wide overview for RallyHub super admins."
      actions={
        <NeoButton variant="surface" asChild>
          <Link to="/admin/clients">View clients</Link>
        </NeoButton>
      }
    >
      {isLoading ? (
        <QueryLoading rows={4} />
      ) : isError ? (
        <QueryError message={error?.message} />
      ) : (
        <div className="space-y-8">
          {/* Same stat card as the client dashboard: label and icon on one
              row, the number underneath. */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Clients" value={data?.clientCount ?? 0} icon={IconOrganisation} />
            <StatTile label="Active events" value={data?.activeEvents ?? 0} icon={IconLive} />
            <StatTile label="Upcoming events" value={data?.upcomingEvents ?? 0} icon={IconEvents} />
            <StatTile label="Total events" value={data?.totalEvents ?? 0} icon={IconBolt} />
          </section>

          <section className="space-y-3">
            <h2 className="text-foreground text-xl font-semibold tracking-tight">Revenue</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label="Outstanding"
                value={formatEur(data?.revenue.outstanding ?? 0)}
                hint="Unpaid event invoices"
                icon={IconBilling}
              />
              <StatTile
                label="Collected"
                value={formatEur(data?.revenue.collected ?? 0)}
                hint="Paid event invoices"
                icon={IconBilling}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-foreground text-xl font-semibold tracking-tight">
              Events by status
            </h2>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((status) => {
                const count = data?.statusBreakdown?.[status] ?? 0
                return (
                  <span
                    key={status}
                    className="border-border/80 bg-card text-muted-foreground flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium capitalize shadow-sm"
                  >
                    {/* The indicator prints the label itself; printing it
                        again beside it is where "Ready Ready" comes from. */}
                    <StatusIndicator status={status} />
                    <span className="text-foreground font-bold tabular-nums">{count}</span>
                  </span>
                )
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-foreground text-xl font-semibold tracking-tight">
              Recent events
            </h2>
            {(data?.recentEvents.length ?? 0) === 0 ? (
              <Card className="border-border/80 bg-card px-5 py-8 shadow-sm">
                <p className="text-muted-foreground text-sm">No events across clients yet.</p>
              </Card>
            ) : (
              <Card className="border-border/80 overflow-hidden p-0 shadow-sm">
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
              </Card>
            )}
          </section>
        </div>
      )}
    </AdminPageShell>
  )
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: number | string
  hint?: string
  icon: typeof IconBolt
}) {
  return (
    <Card className="neo-card border-border/80 bg-card text-card-foreground shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="neo-stat-label text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {label}
        </CardTitle>
        <Icon aria-hidden className="text-muted-foreground size-5 opacity-75" />
      </CardHeader>
      <CardContent>
        <p className="neo-stat-value text-foreground text-[1.75rem] leading-none font-bold tracking-tight tabular-nums sm:text-[2rem]">
          {value}
        </p>
        {hint ? <p className="text-muted-foreground mt-2 text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
