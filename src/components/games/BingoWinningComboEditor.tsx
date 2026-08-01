import type { Dispatch, SetStateAction } from 'react'

import { SegmentedPill } from '@/components/neo-minimal'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  MAX_BINGO_LINES_REQUIRED,
  MIN_BINGO_LINES_REQUIRED,
  resolveBingoWinConfig,
} from '@/lib/bingo-lines'
import type { GameConfig } from '@/types/game-config'

type BingoWinningComboEditorProps = {
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return MIN_BINGO_LINES_REQUIRED
  return Math.min(MAX_BINGO_LINES_REQUIRED, Math.max(MIN_BINGO_LINES_REQUIRED, Math.round(n)))
}

/**
 * Winning conditions: how many lines a team must complete, and whether the two
 * diagonals count as lines.
 *
 * ponytail: the full-house mode is gone from the UI (no game in the database
 * used it) but resolveBingoWinConfig still honours it, so any config saved
 * before this still plays the way it was set up.
 */
export function BingoWinningComboEditor({ config, setConfig }: BingoWinningComboEditorProps) {
  const win = resolveBingoWinConfig(config)

  function setLinesRequired(n: number) {
    setConfig((c) => ({ ...c, bingo_win_mode: 'lines', bingo_lines_required: clamp(n) }))
  }

  const lineWord = win.linesRequired === 1 ? 'line' : 'lines'

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Winning conditions</Label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="border-border/80 hover:bg-muted/40 size-8 rounded-md border text-lg font-semibold disabled:opacity-40"
            disabled={win.linesRequired <= MIN_BINGO_LINES_REQUIRED}
            onClick={() => setLinesRequired(win.linesRequired - 1)}
            aria-label="Decrease lines"
          >
            −
          </button>
          <Input
            type="number"
            min={MIN_BINGO_LINES_REQUIRED}
            max={MAX_BINGO_LINES_REQUIRED}
            aria-label="Lines required to win"
            className="bg-background h-8 w-16 text-center"
            value={win.linesRequired}
            onChange={(e) => setLinesRequired(Number(e.target.value))}
          />
          <button
            type="button"
            className="border-border/80 hover:bg-muted/40 size-8 rounded-md border text-lg font-semibold disabled:opacity-40"
            disabled={win.linesRequired >= MAX_BINGO_LINES_REQUIRED}
            onClick={() => setLinesRequired(win.linesRequired + 1)}
            aria-label="Increase lines"
          >
            +
          </button>
          <span className="text-muted-foreground text-xs">{lineWord} to win</span>

          <span className="text-muted-foreground ml-1 text-xs">Diagonals</span>
          <SegmentedPill
            size="sm"
            className="w-24"
            aria-label="Count diagonals as lines"
            options={[
              { value: 'no', label: 'No' },
              { value: 'yes', label: 'Yes' },
            ]}
            value={win.includeDiagonals ? 'yes' : 'no'}
            onChange={(next) =>
              setConfig((c) => ({ ...c, bingo_include_diagonals: next === 'yes' }))
            }
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Bingo win points</Label>
          <Input
            type="number"
            min={0}
            className="bg-background h-8"
            value={config.bingo_line_points ?? 100}
            onChange={(e) =>
              setConfig((c) => ({ ...c, bingo_line_points: Number(e.target.value) || 0 }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Points per correct song</Label>
          <Input
            type="number"
            min={0}
            className="bg-background h-8"
            value={config.bingo_points_per_correct ?? 10}
            onChange={(e) =>
              setConfig((c) => ({ ...c, bingo_points_per_correct: Number(e.target.value) || 0 }))
            }
          />
        </div>
      </div>
    </div>
  )
}
