import { Link } from 'react-router-dom'

import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { NoOrganizationMessage } from '@/components/admin/QueryState'
import { NeoButton, NeoCard } from '@/components/neo-minimal'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { useOrganizationId } from '@/hooks/use-organization-id'
import { useOrganization } from '@/hooks/use-organization-settings'
import { useDashboardStats, useRecentEvents } from '@/hooks/use-dashboard'
import { formatPlanLabel } from '@/lib/subscription-plans'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Client-admin home: at-a-glance stats, recent events, and quick actions. */
export function ClientDashboardPage() {
  const organizationId = useOrganizationId()
  const orgQuery = useOrganization(organizationId)
  const statsQuery = useDashboardStats(organizationId)
  const recentQuery = useRecentEvents(organizationId)

  if (!organizationId) {
    return (
      <AdminPageShell title="Dashboard" subtitle="Your events at a glance.">
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  const stats = statsQuery.data
  const recent = recentQuery.data ?? []
  const orgName = orgQuery.data?.name

  const cards: { label: string; value: number | undefined; to: string }[] = [
    { label: 'Upcoming (ready)', value: stats?.upcomingEvents, to: '/admin/events' },
    { label: 'Live now', value: stats?.activeEvents, to: '/admin/events' },
    { label: 'Total events', value: stats?.totalEvents, to: '/admin/events' },
    { label: 'Games', value: stats?.totalGames, to: '/admin/games' },
  ]

  return (
    <AdminPageShell
      title={orgName ? `Welcome, ${orgName}` : 'Dashboard'}
      subtitle="Your events at a glance."
      actions={
        <NeoButton variant="accent" asChild>
          <Link to="/admin/events/new">Create New Event</Link>
        </NeoButton>
      }
    >
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((c) => (
            <Link key={c.label} to={c.to}>
              <NeoCard className="hover:bg-muted/30 h-full p-4 transition-colors">
                <p className="text-foreground text-3xl font-semibold tabular-nums">
                  {c.value ?? '—'}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">{c.label}</p>
              </NeoCard>
            </Link>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <NeoCard className="space-y-4 p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-foreground text-lg font-semibold">Recent events</h2>
              <Link
                to="/admin/events"
                className="text-muted-foreground text-sm underline-offset-2 hover:underline"
              >
                View all
              </Link>
            </div>
            {recentQuery.isLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : recent.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No events yet.{' '}
                <Link to="/admin/events/new" className="underline underline-offset-2">
                  Create your first event
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-border/50 divide-y">
                {recent.map((e) => (
                  <li key={e.id}>
                    <Link
                      to={`/admin/events/${e.id}`}
                      className="hover:bg-muted/30 -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {e.name}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {formatDate(e.dateISO)}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <StatusIndicator status={e.status} />
                        <span className="text-muted-foreground text-xs capitalize">
                          {e.status}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </NeoCard>

          <div className="space-y-6">
            <NeoCard className="space-y-3 p-5">
              <h2 className="text-foreground text-lg font-semibold">Your plan</h2>
              <p className="text-foreground text-2xl font-semibold">
                {formatPlanLabel(orgQuery.data?.billing_plan)}
              </p>
              <NeoButton variant="surface" size="sm" asChild>
                <Link to="/admin/settings?tab=billing">Manage billing</Link>
              </NeoButton>
            </NeoCard>

            <NeoCard className="space-y-3 p-5">
              <h2 className="text-foreground text-lg font-semibold">Quick links</h2>
              <div className="flex flex-col gap-2">
                <NeoButton variant="surface" size="sm" asChild>
                  <Link to="/admin/games">Games & Music</Link>
                </NeoButton>
                <NeoButton variant="surface" size="sm" asChild>
                  <Link to="/admin/team">Team</Link>
                </NeoButton>
                <NeoButton variant="surface" size="sm" asChild>
                  <Link to="/admin/settings">Settings</Link>
                </NeoButton>
                <NeoButton variant="surface" size="sm" asChild>
                  <Link to="/admin/support">Support</Link>
                </NeoButton>
              </div>
            </NeoCard>
          </div>
        </div>
      </div>
    </AdminPageShell>
  )
}
