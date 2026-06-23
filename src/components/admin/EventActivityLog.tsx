import { Users, Monitor, Shield, Cpu, RefreshCw, Download } from 'lucide-react'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { Button } from '@/components/ui/button'
import { downloadCsv, toCsv } from '@/lib/csv'
import {
  activityActionLabel,
  useEventActivityLog,
  type ActivityLogRow,
} from '@/hooks/use-event-activity-log'

function actorIcon(actorType: ActivityLogRow['actor_type']) {
  switch (actorType) {
    case 'team': return <Users className="size-4 text-blue-500" />
    case 'facilitator': return <Monitor className="size-4 text-purple-500" />
    case 'admin': return <Shield className="size-4 text-orange-500" />
    case 'system': return <Cpu className="size-4 text-muted-foreground" />
  }
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function EventActivityLog({ eventId }: { eventId: string }) {
  const query = useEventActivityLog(eventId)
  const rows = query.data ?? []

  function handleDownload() {
    const csv = toCsv(
      ['Time', 'Actor type', 'Actor', 'Action', 'Details'],
      rows.map((r) => [
        new Date(r.created_at).toISOString(),
        r.actor_type,
        r.actor_name ?? '',
        activityActionLabel(r),
        r.details ? JSON.stringify(r.details) : '',
      ]),
    )
    downloadCsv(`event-log-${eventId}.csv`, csv)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Real-time log of who joined, stage changes, submissions, and key actions.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={rows.length === 0}
            onClick={handleDownload}
          >
            <Download className="mr-1.5 size-3.5" />
            Download CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw className={`mr-1.5 size-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <QueryLoading rows={6} />
      ) : query.isError ? (
        <QueryError message={query.error.message} />
      ) : !query.data?.length ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 py-12 text-center">
          <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Activity is logged when teams join, stages advance, and submissions are reviewed.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/50 overflow-hidden">
          {query.data.map((row) => (
            <div key={row.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20">
              <div className="mt-0.5 shrink-0">{actorIcon(row.actor_type)}</div>
              <div className="min-w-0 flex-1">
                <span className="text-foreground text-sm font-medium">
                  {row.actor_name ?? row.actor_type}
                </span>
                <span className="text-muted-foreground mx-1.5 text-sm">—</span>
                <span className="text-muted-foreground text-sm">{activityActionLabel(row)}</span>
              </div>
              <time className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {formatTime(row.created_at)}
              </time>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
