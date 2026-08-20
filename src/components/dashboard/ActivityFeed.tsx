import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { IconClock } from '@/components/icons'
import { NeoCard } from '@/components/neo-minimal'
import { useOptionalTenant } from '@/contexts/tenant-context'
import { orgPath } from '@/lib/org-path'
import type { RecentEventRow } from '@/hooks/use-dashboard'

function relativeTime(
  iso: string | null,
  t: TFunction<'admin'>,
  language: string,
): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const minutes = Math.round((Date.now() - then) / 60000)
  if (minutes < 1) return t('dashboard.timeJustNow')
  if (minutes < 60) return t('dashboard.timeMinutesAgo', { count: minutes })

  const hours = Math.round(minutes / 60)
  if (hours < 24) return t('dashboard.timeHoursAgo', { count: hours })

  const days = Math.round(hours / 24)
  if (days < 30) return t('dashboard.timeDaysAgo', { count: days })

  // Anything older falls back to a date, written in the active language.
  return new Date(iso).toLocaleDateString(language, {
    day: 'numeric',
    month: 'short',
  })
}

type ActivityFeedProps = {
  events: RecentEventRow[]
  isLoading: boolean
}

/**
 * Recent activity. Backed by recent events, since there is no cross-entity
 * activity log yet.
 */
export function ActivityFeed({ events, isLoading }: ActivityFeedProps) {
  const { t, i18n } = useTranslation('admin')
  const clientSlug = useOptionalTenant()?.tenantOrg?.subdomain ?? null
  return (
    <NeoCard className="flex h-full flex-col p-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold whitespace-nowrap">
          {t('dashboard.recentActivity')}
        </h2>
        <Link
          to={orgPath(clientSlug, "/admin/events")}
          className="text-nm-neutral-500 shrink-0 text-xs hover:underline"
        >
          {t('dashboard.viewAll')}
        </Link>
      </div>

      {isLoading ? (
        <p className="text-nm-neutral-500 py-2 text-xs">{t('common:loading')}…</p>
      ) : events.length === 0 ? (
        <p className="text-nm-neutral-500 py-2 text-xs">
          {t('dashboard.noEventsYet')}{' '}
          <Link to={orgPath(clientSlug, "/admin/events/new")} className="underline">
            {t('dashboard.createFirstEvent')}
          </Link>
          .
        </p>
      ) : (
        <ul>
          {events.map((event) => (
            <li
              key={event.id}
              className="border-border flex gap-2.5 border-t py-2"
            >
              <span className="bg-nm-yellow/20 text-nm-charcoal flex size-[30px] shrink-0 items-center justify-center rounded-full">
                <IconClock className="size-3.5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  to={orgPath(clientSlug, `/admin/events/${event.id}`)}
                  className="block truncate text-sm hover:underline"
                >
                  {event.name}
                </Link>
                <p className="text-nm-neutral-500 text-xs">
                  {relativeTime(event.dateISO, t, i18n.language)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </NeoCard>
  )
}
