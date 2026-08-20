import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { NeoCard } from '@/components/neo-minimal'

type StatCardProps = {
  label: string
  value: number | undefined
  to: string
  /**
   * Change against the same count seven days ago. Undefined means this stat has
   * no truthful comparison available, in which case no line is shown at all
   * rather than a zero that would read as "nothing changed".
   */
  delta?: number
}

/** One Overview stat tile, with the design's week-over-week line when we have it. */
export function StatCard({ label, value, to, delta }: StatCardProps) {
  const { t } = useTranslation('admin')

  // The sign lives in the key, not in the number, so a translation can put it
  // wherever the language wants it. Both directions get an absolute count so
  // plural forms resolve the same way up or down.
  const trend =
    delta === undefined
      ? null
      : delta === 0
        ? t('dashboard.noChangeFromLastWeek')
        : delta > 0
          ? t('dashboard.upFromLastWeek', { count: delta })
          : t('dashboard.downFromLastWeek', { count: -delta })

  return (
    <Link to={to}>
      <NeoCard interactive className="h-full p-4">
        <p className="text-nm-neutral-500 mb-1 text-[10px] font-semibold tracking-wider uppercase">
          {label}
        </p>
        <p className="text-4xl font-bold tabular-nums">{value ?? 0}</p>
        {trend === null ? null : (
          <p className="text-nm-neutral-500 mt-1 text-xs">{trend}</p>
        )}
      </NeoCard>
    </Link>
  )
}
