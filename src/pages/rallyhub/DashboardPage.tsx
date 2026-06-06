import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { NeoCard, NeoPageShell } from '@/components/neo-minimal'
import { useRallyHubDashboard } from '@/hooks/use-rallyhub'
import { cn } from '@/lib/utils'

export function RallyHubOverviewPage() {
  const { data, isLoading, isError, error } = useRallyHubDashboard()

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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Clients" value={data?.clientCount ?? 0} />
          <StatTile label="Total events" value={data?.totalEvents ?? 0} />
          <StatTile label="Active events" value={data?.activeEvents ?? 0} />
          <StatTile label="Revenue" value="—" hint="Overview coming soon" />
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
