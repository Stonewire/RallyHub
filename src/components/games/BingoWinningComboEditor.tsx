import type { Dispatch, SetStateAction } from 'react'

import { FlipSwitch } from '@/components/neo-minimal'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  BINGO_DIAGONAL_LINES,
  MAX_BINGO_LINES_REQUIRED,
  MIN_BINGO_LINES_REQUIRED,
  resolveBingoWinConfig,
} from '@/lib/bingo-lines'
import { cn } from '@/lib/utils'
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
  const diagSet = new Set(BINGO_DIAGONAL_LINES.flat())

  function setLinesRequired(n: number) {
    setConfig((c) => ({ ...c, bingo_win_mode: 'lines', bingo_lines_required: clamp(n) }))
  }

  const lineWord = win.linesRequired === 1 ? 'line' : 'lines'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Label>Winning conditions</Label>
          <div className="flex items-center gap-2">
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
          </div>
        </div>

        <FlipSwitch
          caption="Diagonals"
          offValue="off"
          onValue="on"
          offLabel="No"
          onLabel="Yes"
          value={win.includeDiagonals ? 'on' : 'off'}
          onChange={(next) =>
            setConfig((c) => ({ ...c, bingo_include_diagonals: next === 'on' }))
          }
        />
      </div>

      <div className="flex items-start gap-3">
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
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

        {/* Shows at a glance which cells the diagonals switch brings into play. */}
        <div className="grid shrink-0 grid-cols-5 gap-0.5 self-end rounded-md border p-1.5">
          {Array.from({ length: 25 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'size-2 rounded-[2px]',
                win.includeDiagonals && diagSet.has(i) ? 'bg-nm-yellow' : 'bg-muted',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
