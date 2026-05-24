import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { useRallyHubDashboard } from '@/hooks/use-rallyhub'

export function RallyHubOverviewPage() {
  const { data, isLoading, isError, error } = useRallyHubDashboard()

  return (
    <AdminPageShell
      title="Dashboard"
      subtitle="Platform-wide overview for RallyHub super admins."
    >
      {isLoading ? (
        <QueryLoading rows={4} />
      ) : isError ? (
        <QueryError message={error?.message} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Clients" value={data?.clientCount ?? 0} />
          <StatCard label="Total events" value={data?.totalEvents ?? 0} />
          <StatCard label="Active events" value={data?.activeEvents ?? 0} />
          <StatCard label="Revenue" value="—" hint="Overview coming soon" />
        </div>
      )}
    </AdminPageShell>
  )
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: number | string
  hint?: string
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-foreground text-3xl font-bold tabular-nums">{value}</p>
        {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
