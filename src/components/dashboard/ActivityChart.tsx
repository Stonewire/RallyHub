import { useState } from 'react'

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

const METRICS: { key: ActivityMetric; label: string }[] = [
  { key: 'submissions', label: 'Submissions' },
  { key: 'teams', label: 'Teams playing' },
]

type ActivityChartProps = {
  organizationId: string
}

/** 30-day activity chart, hand-rolled SVG so no charting dependency is needed. */
export function ActivityChart({ organizationId }: ActivityChartProps) {
  const [metric, setMetric] = useState<ActivityMetric>('submissions')
  const { data, isLoading } = useActivitySeries(organizationId, metric)
  const points = data ?? []
  const total = points.reduce((sum, point) => sum + point.value, 0)
  const peak = Math.max(...points.map((point) => point.value), 0)

  return (
    <NeoCard className="flex h-full min-h-55 flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">Participation</h2>
          <p className="text-nm-neutral-500 text-xs">Last 30 days</p>
        </div>
        <div className="bg-nm-slate-700 flex rounded-full p-1">
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
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-nm-neutral-500 flex flex-1 items-center justify-center text-xs">
          Loading…
        </p>
      ) : total === 0 ? (
        <p className="text-nm-neutral-500 flex flex-1 items-center justify-center px-6 text-center text-xs">
          No activity in the last 30 days. Once teams start playing, their
          submissions show up here.
        </p>
      ) : (
        <>
          <div className="mb-2 flex gap-6">
            <div>
              <p className="text-2xl font-bold tabular-nums">{total}</p>
              <p className="text-nm-neutral-500 text-[10px] tracking-wider uppercase">
                Total
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{peak}</p>
              <p className="text-nm-neutral-500 text-[10px] tracking-wider uppercase">
                Busiest day
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              preserveAspectRatio="none"
              className="h-full w-full"
              role="img"
              aria-label={`${metric === 'teams' ? 'Teams playing' : 'Submissions'} over the last 30 days`}
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
