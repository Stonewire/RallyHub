import { NoOrganizationMessage } from '@/components/admin/QueryState'
import { ActivityChart } from '@/components/dashboard/ActivityChart'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { GameTypeBreakdown } from '@/components/dashboard/GameTypeBreakdown'
import { StatCard } from '@/components/dashboard/StatCard'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { useDashboardStats, useRecentEvents } from '@/hooks/use-dashboard'
import { useOrganizationId } from '@/hooks/use-organization-id'
import { orgPath } from '@/lib/org-path'
import { useOptionalTenant } from '@/contexts/tenant-context'

/** Client-admin Overview: stats, 30-day participation and recent activity. */
export function ClientDashboardPage() {
  const organizationId = useOrganizationId()
  const clientSlug = useOptionalTenant()?.tenantOrg?.subdomain ?? null
  const statsQuery = useDashboardStats(organizationId)
  const recentQuery = useRecentEvents(organizationId)

  if (!organizationId) {
    return (
      <AdminPageShell title="Overview" subtitle="Your events at a glance.">
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  const stats = statsQuery.data

  // Live Now and Upcoming Events read the current status column, and no status
  // history is kept, so their week-ago value cannot be reconstructed. They get
  // no delta rather than a made-up one.
  const cards = [
    {
      label: 'Available Games',
      value: stats?.totalGames,
      to: orgPath(clientSlug, '/admin/games'),
      delta: stats?.gamesDelta,
    },
    { label: 'Upcoming Events', value: stats?.upcomingEvents, to: orgPath(clientSlug, '/admin/events') },
    { label: 'Live Now', value: stats?.activeEvents, to: orgPath(clientSlug, '/admin/events') },
    {
      label: 'Total Events',
      value: stats?.totalEvents,
      to: orgPath(clientSlug, '/admin/events'),
      delta: stats?.totalEventsDelta,
    },
  ]

  return (
    <div className="px-6 py-8 lg:px-8">
      <h1 className="mb-1 text-3xl font-bold">Overview</h1>
      <p className="text-nm-neutral-500 mb-6 text-sm">
        Welcome back. Here's what's happening across your organisation today.
      </p>

      {/* Wide layout mirrors the design: stat tiles and panels stacked on the
          left, the chart occupying the tall right-hand region. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_minmax(0,2.2fr)]">
        {cards.map((card) => (
          <div key={card.label} className="xl:col-span-1">
            <StatCard
              label={card.label}
              value={card.value}
              to={card.to}
              delta={card.delta}
            />
          </div>
        ))}

        <div className="xl:col-start-3 xl:row-span-3 xl:row-start-1">
          <ActivityChart organizationId={organizationId} />
        </div>

        <div className="xl:col-span-2 xl:col-start-1">
          <ActivityFeed
            events={recentQuery.data ?? []}
            isLoading={recentQuery.isLoading}
          />
        </div>

        <div className="xl:col-span-2 xl:col-start-1">
          <GameTypeBreakdown organizationId={organizationId} />
        </div>
      </div>
    </div>
  )
}
