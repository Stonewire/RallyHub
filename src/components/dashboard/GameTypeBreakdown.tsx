import { NeoCard } from '@/components/neo-minimal'
import { useGameTypeBreakdown } from '@/hooks/use-dashboard'
import type { GameType } from '@/types/database'

const TYPE_LABEL: Record<GameType, string> = {
  photo: 'Photo',
  video: 'Video',
  text: 'Text',
  puzzle: 'Puzzle',
  quiz: 'Quiz',
  music_bingo: 'Music Bingo',
}

type GameTypeBreakdownProps = {
  organizationId: string
}

/** Which game types teams actually played over the same 30-day window. */
export function GameTypeBreakdown({ organizationId }: GameTypeBreakdownProps) {
  const { data, isLoading } = useGameTypeBreakdown(organizationId)
  const rows = data ?? []
  const max = Math.max(...rows.map((row) => row.count), 0)

  return (
    <NeoCard className="flex h-full flex-col p-4">
      <h2 className="text-sm font-bold">By Game Type</h2>
      <p className="text-nm-neutral-500 mb-3 text-xs">Last 30 days</p>

      {isLoading ? (
        <p className="text-nm-neutral-500 text-xs">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-nm-neutral-500 text-xs">Nothing played yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <li key={row.type}>
              <div className="mb-1 flex justify-between text-xs">
                <span>{TYPE_LABEL[row.type]}</span>
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
