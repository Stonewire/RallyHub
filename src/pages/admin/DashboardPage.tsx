import { Calendar, Layers, Radio, Zap } from 'lucide-react'

import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { useDashboardStats, useRecentEvents } from '@/hooks/use-dashboard'
import { useOrganizationId } from '@/hooks/use-organization-id'

const STAT_META = [
  { key: 'totalGames' as const, label: 'Total Games', icon: Layers },
  { key: 'totalEvents' as const, label: 'Total Events', icon: Zap },
  { key: 'activeEvents' as const, label: 'Active Events', icon: Radio },
  { key: 'upcomingEvents' as const, label: 'Upcoming Events', icon: Calendar },
]

function formatEventDate(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function AdminDashboardPage() {
  const organizationId = useOrganizationId()
  const statsQuery = useDashboardStats(organizationId)
  const recentQuery = useRecentEvents(organizationId)

  if (!organizationId) {
    return (
      <AdminPageShell
        title="Dashboard"
        subtitle="Overview of games and events across your organization."
      >
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  return (
    <AdminPageShell
      title="Dashboard"
      subtitle="Overview of games and events across your organization."
    >
      {statsQuery.isLoading ? (
        <QueryLoading rows={4} />
      ) : statsQuery.isError ? (
        <QueryError message={statsQuery.error.message} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STAT_META.map(({ key, label, icon: Icon }) => (
            <Card
              key={label}
              className="border-border/80 bg-card text-card-foreground shadow-sm shadow-[rgb(62_61_62/0.05)]"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  {label}
                </CardTitle>
                <Icon
                  aria-hidden
                  className="text-muted-foreground size-5 opacity-75"
                />
              </CardHeader>
              <CardContent>
                <p className="text-foreground font-bold tabular-nums tracking-tight text-[1.75rem] leading-none sm:text-[2rem]">
                  {statsQuery.data?.[key] ?? 0}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <section className="mt-10 sm:mt-12">
        <h2 className="text-foreground mb-5 text-xl font-semibold tracking-tight">
          Recent Events
        </h2>
        {recentQuery.isLoading ? (
          <QueryLoading rows={3} />
        ) : recentQuery.isError ? (
          <QueryError message={recentQuery.error.message} />
        ) : (recentQuery.data?.length ?? 0) === 0 ? (
          <Card className="border-border/80 bg-card px-5 py-8 shadow-sm shadow-[rgb(62_61_62/0.05)]">
            <p className="text-muted-foreground text-sm">No events yet.</p>
          </Card>
        ) : (
          <Card className="border-border/80 overflow-hidden shadow-sm shadow-[rgb(62_61_62/0.05)]">
            <ul className="divide-border divide-y">
              {recentQuery.data?.map((event) => (
                <li
                  key={event.id}
                  className="hover:bg-muted/30 flex flex-col gap-4 px-5 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-foreground font-semibold leading-snug">
                      {event.name}
                    </p>
                    <time
                      dateTime={event.dateISO ?? undefined}
                      className="text-muted-foreground mt-1 block text-sm font-normal"
                    >
                      {formatEventDate(event.dateISO)}
                    </time>
                  </div>
                  <div className="shrink-0 sm:min-w-[6.5rem] sm:text-right">
                    <StatusIndicator status={event.status} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </AdminPageShell>
  )
}
