import { useTranslation } from 'react-i18next'

import { NeoCard } from '@/components/neo-minimal'
import { useGameTypeBreakdown } from '@/hooks/use-dashboard'
import { GAME_TYPE_LABEL_KEYS } from '@/hooks/use-games'

type GameTypeBreakdownProps = {
  organizationId: string
}

/** Which game types teams actually played over the same 30-day window. */
export function GameTypeBreakdown({ organizationId }: GameTypeBreakdownProps) {
  const { t } = useTranslation('admin')
  const { data, isLoading } = useGameTypeBreakdown(organizationId)
  const rows = data ?? []
  const max = Math.max(...rows.map((row) => row.count), 0)

  return (
    <NeoCard className="flex h-full flex-col p-4">
      <h2 className="text-sm font-bold">{t('dashboard.byGameType')}</h2>
      <p className="text-nm-neutral-500 mb-3 text-xs">
        {t('dashboard.last30Days')}
      </p>

      {isLoading ? (
        <p className="text-nm-neutral-500 text-xs">{t('common:loading')}…</p>
      ) : rows.length === 0 ? (
        <p className="text-nm-neutral-500 text-xs">
          {t('dashboard.nothingPlayedYet')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <li key={row.type}>
              <div className="mb-1 flex justify-between text-xs">
                {/* Shared game type labels, so a rename lands everywhere at once. */}
                <span>{t(GAME_TYPE_LABEL_KEYS[row.type])}</span>
                <span className="font-semibold tabular-nums">{row.count}</span>
              </div>
              <div className="bg-nm-neutral-200 h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-nm-yellow h-full rounded-full"
                  style={{
                    width: `${max === 0 ? 0 : (row.count / max) * 100}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </NeoCard>
  )
}
