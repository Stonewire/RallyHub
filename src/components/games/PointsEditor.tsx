import { useTranslation } from 'react-i18next'

import { SegmentedPill } from '@/components/neo-minimal'
import { NumberField } from '@/components/ui/number-field'
import { Label } from '@/components/ui/label'
import type { PointsType } from '@/types/database'

/** Points mode and its value on one line. Shared by creating and editing. */
export function PointsEditor({
  pointsType,
  setPointsType,
  pointsStatic,
  setPointsStatic,
  pointsMin,
  setPointsMin,
  pointsMax,
  setPointsMax,
}: {
  pointsType: PointsType
  setPointsType: (v: PointsType) => void
  pointsStatic: number
  setPointsStatic: (v: number) => void
  pointsMin: number
  setPointsMin: (v: number) => void
  pointsMax: number
  setPointsMax: (v: number) => void
}) {
  const { t } = useTranslation('admin')
  // Label, mode and value on a single line. Points is one small setting and
  // was taking three rows of height to say so.
  return (
    <div className="flex w-full items-center gap-3">
      <Label className="shrink-0">{t('games.points')}</Label>
      <div className="flex flex-1 items-center gap-2">
        <SegmentedPill
          size="sm"
          className="flex-1"
          aria-label={t('games.pointsType')}
          options={[
            { value: 'static', label: t('games.pointsStatic') },
            { value: 'range', label: t('games.pointsRange') },
          ]}
          value={pointsType}
          onChange={(next) => setPointsType(next as PointsType)}
        />
        {pointsType === 'static' ? (
          <NumberField
            aria-label={t('games.points')}
            value={pointsStatic}
            onChange={setPointsStatic}
            className="bg-background h-8 w-24 shrink-0"
          />
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <NumberField
              placeholder={t('games.pointsMinShort')}
              aria-label={t('games.minimumPoints')}
              value={pointsMin}
              onChange={setPointsMin}
              className="bg-background h-8 w-24 shrink-0"
            />
            <span className="text-muted-foreground text-sm">{t('games.pointsRangeTo')}</span>
            <NumberField
              placeholder={t('games.pointsMaxShort')}
              aria-label={t('games.maximumPoints')}
              value={pointsMax}
              onChange={setPointsMax}
              className="bg-background h-8 w-24 shrink-0"
            />
          </div>
        )}
      </div>
    </div>
  )
}
