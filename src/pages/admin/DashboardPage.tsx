import { IconBolt, IconEvents, IconLayers, IconLive } from '@/components/icons'
import { useTranslation } from 'react-i18next'

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
  { key: 'totalGames' as const, labelKey: 'dashboard.totalGames', icon: IconLayers },
  { key: 'totalEvents' as const, labelKey: 'dashboard.totalEvents', icon: IconBolt },
  { key: 'activeEvents' as const, labelKey: 'dashboard.activeEvents', icon: IconLive },
  { key: 'upcomingEvents' as const, labelKey: 'dashboard.upcomingEvents', icon: IconEvents },
]

function formatEventDate(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function AdminDashboardPage() {
  const { t } = useTranslation('admin')
  const organizationId = useOrganizationId()
  const statsQuery = useDashboardStats(organizationId)
  const recentQuery = useRecentEvents(organizationId)

  if (!organizationId) {
    return (
      <AdminPageShell
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
      >
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  return (
    <AdminPageShell
      title={t('dashboard.title')}
      subtitle={t('dashboard.subtitle')}
    >
      {statsQuery.isLoading ? (
        <QueryLoading rows={4} />
      ) : statsQuery.isError ? (
        <QueryError message={statsQuery.error.message} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STAT_META.map(({ key, labelKey, icon: Icon }) => (
            <Card
              key={key}
              className="neo-card border-border/80 bg-card text-card-foreground shadow-sm"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="neo-stat-label text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  {t(labelKey)}
                </CardTitle>
                <Icon
                  aria-hidden
                  className="text-muted-foreground size-5 opacity-75"
                />
              </CardHeader>
              <CardContent>
                <p className="neo-stat-value text-foreground font-bold tabular-nums tracking-tight text-[1.75rem] leading-none sm:text-[2rem]">
                  {statsQuery.data?.[key] ?? 0}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <section className="mt-10 sm:mt-12">
        <h2 className="text-foreground mb-5 text-xl font-semibold tracking-tight">
          {t('dashboard.recentEvents')}
        </h2>
        {recentQuery.isLoading ? (
          <QueryLoading rows={3} />
        ) : recentQuery.isError ? (
          <QueryError message={recentQuery.error.message} />
        ) : (recentQuery.data?.length ?? 0) === 0 ? (
          <Card className="border-border/80 bg-card px-5 py-8 shadow-sm shadow-[rgb(62_61_62/0.05)]">
            <p className="text-muted-foreground text-sm">{t('dashboard.noEventsYet')}</p>
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
