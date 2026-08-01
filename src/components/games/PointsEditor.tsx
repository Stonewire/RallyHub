import { SegmentedPill } from '@/components/neo-minimal'
import { Input } from '@/components/ui/input'
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
  return (
    <div className="space-y-2">
      <Label>Points</Label>
      {/* Pill plus the value on one line: the mode and the number it applies to
          belong together, and this matches the segmented controls used
          elsewhere rather than the flip switch, which read as on/off. */}
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedPill
          size="sm"
          aria-label="Points type"
          options={[
            { value: 'static', label: 'Static' },
            { value: 'range', label: 'Range' },
          ]}
          value={pointsType}
          onChange={(next) => setPointsType(next as PointsType)}
        />
        {pointsType === 'static' ? (
          <Input
            type="number"
            aria-label="Points"
            value={pointsStatic}
            onChange={(e) => setPointsStatic(Number(e.target.value))}
            className="bg-background w-24"
          />
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              aria-label="Minimum points"
              value={pointsMin}
              onChange={(e) => setPointsMin(Number(e.target.value))}
              className="bg-background w-24"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              type="number"
              placeholder="Max"
              aria-label="Maximum points"
              value={pointsMax}
              onChange={(e) => setPointsMax(Number(e.target.value))}
              className="bg-background w-24"
            />
          </div>
        )}
      </div>
    </div>
  )
}
