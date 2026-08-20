import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconChip, IconDisplay, IconDownload, IconRefresh, IconShield, IconUsers } from '@/components/icons'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { Button } from '@/components/ui/button'
import { downloadCsv, toCsv } from '@/lib/csv'
import {
  ACTION_LABELS,
  activityActionLabel,
  useEventActivityLog,
  type ActivityLogRow,
} from '@/hooks/use-event-activity-log'

const ACTOR_TYPE_LABEL_KEYS: Record<ActivityLogRow['actor_type'], string> = {
  team: 'events.log.actorType.team',
  facilitator: 'events.log.actorType.facilitator',
  admin: 'events.log.actorType.admin',
  system: 'events.log.actorType.system',
}

function actorIcon(actorType: ActivityLogRow['actor_type']) {
  switch (actorType) {
    case 'team': return <IconUsers className="size-4 text-blue-500" />
    case 'facilitator': return <IconDisplay className="size-4 text-purple-500" />
    case 'admin': return <IconShield className="size-4 text-orange-500" />
    case 'system': return <IconChip className="size-4 text-muted-foreground" />
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

const ALL = '__all__'
const EMPTY_ROWS: ActivityLogRow[] = []

export function EventActivityLog({ eventId }: { eventId: string }) {
  const { t } = useTranslation('admin')
  const query = useEventActivityLog(eventId)
  const rows = query.data ?? EMPTY_ROWS
  const [actorFilter, setActorFilter] = useState(ALL)
  const [actionFilter, setActionFilter] = useState(ALL)

  const actorOptions = useMemo(() => {
    const seen = new Map<string, { actorType: ActivityLogRow['actor_type']; label: string }>()
    for (const r of rows) {
      const key = `${r.actor_type}:${r.actor_name ?? ''}`
      if (seen.has(key)) continue
      const typeLabel = t(ACTOR_TYPE_LABEL_KEYS[r.actor_type])
      const label = r.actor_name ? `${typeLabel}: ${r.actor_name}` : typeLabel
      seen.set(key, { actorType: r.actor_type, label })
    }
    return [...seen.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [rows, t])

  const actionOptions = useMemo(() => {
    const seen = new Set(rows.map((r) => r.action))
    return [...seen]
      .map((action) => ({ action, label: ACTION_LABELS[action] ?? action }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [rows])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (actorFilter !== ALL && `${r.actor_type}:${r.actor_name ?? ''}` !== actorFilter) {
        return false
      }
      if (actionFilter !== ALL && r.action !== actionFilter) return false
      return true
    })
  }, [rows, actorFilter, actionFilter])

  const filtersActive = actorFilter !== ALL || actionFilter !== ALL

  function handleDownload() {
    const csv = toCsv(
      [
        t('events.log.csv.time'),
        t('events.log.csv.actorType'),
        t('events.log.csv.actor'),
        t('events.log.csv.action'),
        t('events.log.csv.details'),
      ],
      filteredRows.map((r) => [
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {t('events.log.description')}
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={filteredRows.length === 0}
            onClick={handleDownload}
          >
            <IconDownload className="mr-1.5 size-3.5" />
            {t('events.log.downloadCsv')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <IconRefresh className={`mr-1.5 size-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />
            {t('events.log.refresh')}
          </Button>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="border-input bg-background rounded-lg border px-3 py-1.5 text-sm"
          >
            <option value={ALL}>{t('events.log.allTeamsAndFacilitators')}</option>
            {actorOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="border-input bg-background rounded-lg border px-3 py-1.5 text-sm"
          >
            <option value={ALL}>{t('events.log.allActions')}</option>
            {actionOptions.map((o) => (
              <option key={o.action} value={o.action}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {query.isLoading ? (
        <QueryLoading rows={6} />
      ) : query.isError ? (
        <QueryError message={query.error.message} />
      ) : !rows.length ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 py-12 text-center">
          <p className="text-muted-foreground text-sm">{t('events.log.emptyTitle')}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {t('events.log.emptyHint')}
          </p>
        </div>
      ) : !filteredRows.length ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 py-12 text-center">
          <p className="text-muted-foreground text-sm">{t('events.log.noMatch')}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/50 overflow-hidden">
          {filteredRows.map((row) => (
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
      {filtersActive && filteredRows.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          {t('events.log.showing', {
            shown: filteredRows.length,
            total: rows.length,
          })}
        </p>
      ) : null}
    </div>
  )
}
