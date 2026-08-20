import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { NeoCard } from '@/components/neo-minimal'
import { useActivitySeries } from '@/hooks/use-dashboard'
import {
  buildAreaPath,
  buildLinePath,
  type ActivityMetric,
} from '@/lib/dashboard-activity'

// Fixed viewBox; the SVG scales to its container via width/height 100%.
const VIEW_W = 900
const VIEW_H = 320

// i18n keys, not text: the toggle must re-resolve after a language change.
const METRICS: { key: ActivityMetric; labelKey: string }[] = [
  { key: 'submissions', labelKey: 'dashboard.metricSubmissions' },
  { key: 'teams', labelKey: 'dashboard.metricTeams' },
]

type ActivityChartProps = {
  organizationId: string
}

/** 30-day activity chart, hand-rolled SVG so no charting dependency is needed. */
export function ActivityChart({ organizationId }: ActivityChartProps) {
  const { t } = useTranslation('admin')
  const [metric, setMetric] = useState<ActivityMetric>('submissions')
  const { data, isLoading } = useActivitySeries(organizationId, metric)
  const points = data ?? []
  const total = points.reduce((sum, point) => sum + point.value, 0)
  const peak = Math.max(...points.map((point) => point.value), 0)
  const metricLabel = t(
    metric === 'teams' ? 'dashboard.metricTeams' : 'dashboard.metricSubmissions',
  )

  return (
    <NeoCard className="flex h-full min-h-55 flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">{t('dashboard.participation')}</h2>
          <p className="text-nm-neutral-500 text-xs">
            {t('dashboard.last30Days')}
          </p>
        </div>
        {/* The slate ramp mirrors in dark mode, so slate-700 alone would flip to
            a light track and strand the white inactive label. slate-700 (light)
            and slate-300 (dark) both resolve to #2b2e36, keeping it dark. */}
        <div className="bg-nm-slate-700 dark:bg-nm-slate-300 flex rounded-full p-1">
          {METRICS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setMetric(option.key)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                metric === option.key
                  ? 'bg-nm-yellow text-nm-charcoal'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-nm-neutral-500 flex flex-1 items-center justify-center text-xs">
          {t('common:loading')}…
        </p>
      ) : total === 0 ? (
        <p className="text-nm-neutral-500 flex flex-1 items-center justify-center px-6 text-center text-xs">
          {t('dashboard.noActivityWindow')}
        </p>
      ) : (
        <>
          <div className="mb-2 flex gap-6">
            <div>
              <p className="text-2xl font-bold tabular-nums">{total}</p>
              <p className="text-nm-neutral-500 text-[10px] tracking-wider uppercase">
                {/* Summing daily distinct teams counts team-days, not distinct
                    teams, so the label must not claim to be a total. */}
                {metric === 'teams'
                  ? t('dashboard.teamDays')
                  : t('dashboard.total')}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{peak}</p>
              <p className="text-nm-neutral-500 text-[10px] tracking-wider uppercase">
                {t('dashboard.busiestDay')}
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              preserveAspectRatio="none"
              className="h-full w-full"
              role="img"
              aria-label={t('dashboard.chartAria', { metric: metricLabel })}
            >
              <path
                d={buildAreaPath(points, VIEW_W, VIEW_H)}
                fill="var(--nm-yellow)"
                opacity="0.16"
              />
              <path
                d={buildLinePath(points, VIEW_W, VIEW_H)}
                fill="none"
                stroke="var(--nm-yellow)"
                strokeWidth="3"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          <div className="text-nm-neutral-500 mt-1 flex justify-between text-[10px]">
            <span>{points[0]?.date}</span>
            <span>{points.at(-1)?.date}</span>
          </div>
        </>
      )}
    </NeoCard>
  )
}
