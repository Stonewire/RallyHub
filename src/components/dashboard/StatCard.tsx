import { Link } from 'react-router-dom'

import { NeoCard } from '@/components/neo-minimal'

type StatCardProps = {
  label: string
  value: number | undefined
  to: string
}

/**
 * One Overview stat tile. The design shows a week-over-week delta beneath the
 * number; there is no historical comparison in the data yet, so it is omitted
 * rather than faked.
 */
export function StatCard({ label, value, to }: StatCardProps) {
  return (
    <Link to={to}>
      <NeoCard interactive className="h-full p-4">
        <p className="text-nm-neutral-500 mb-1 text-[10px] font-semibold tracking-wider uppercase">
          {label}
        </p>
        <p className="text-4xl font-bold tabular-nums">{value ?? 0}</p>
      </NeoCard>
    </Link>
  )
}
