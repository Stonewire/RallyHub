import type { Dispatch, SetStateAction } from 'react'

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

export function BingoWinningComboEditor({ config, setConfig }: BingoWinningComboEditorProps) {
  const win = resolveBingoWinConfig(config)
  const diagSet = new Set(BINGO_DIAGONAL_LINES.flat())

  function setMode(mode: 'lines' | 'full_house') {
    setConfig((c) => ({
      ...c,
      bingo_win_mode: mode,
      bingo_lines_required: mode === 'lines' ? clamp(c.bingo_lines_required ?? win.linesRequired) : c.bingo_lines_required,
    }))
  }

  function setLinesRequired(n: number) {
    setConfig((c) => ({ ...c, bingo_win_mode: 'lines', bingo_lines_required: clamp(n) }))
  }

  function setIncludeDiagonals(value: boolean) {
    setConfig((c) => ({ ...c, bingo_include_diagonals: value }))
  }

  const lineWord = win.linesRequired === 1 ? 'line' : 'lines'
  const linesHelper =
    `Teams win when they complete any ${win.linesRequired} ${lineWord} ` +
    `(${win.includeDiagonals ? 'rows, columns, or diagonals' : 'rows or columns'}).`

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-foreground font-semibold">Winning condition</h3>
        <p className="text-muted-foreground text-sm">
          Choose how teams win this bingo game.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Win mode</Label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm font-medium',
              win.mode === 'lines'
                ? 'border-[#FFC107] bg-[#FFC107]/20'
                : 'border-border/80 hover:bg-muted/40',
            )}
            onClick={() => setMode('lines')}
          >
            Number of lines
          </button>
          <button
            type="button"
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm font-medium',
              win.mode === 'full_house'
                ? 'border-[#FFC107] bg-[#FFC107]/20'
                : 'border-border/80 hover:bg-muted/40',
            )}
            onClick={() => setMode('full_house')}
          >
            Full house
          </button>
        </div>
      </div>

      {win.mode === 'lines' ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Lines required to win</Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="border-border/80 hover:bg-muted/40 size-9 rounded-md border text-lg font-semibold disabled:opacity-40"
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
                className="bg-background w-20 text-center"
                value={win.linesRequired}
                onChange={(e) => setLinesRequired(Number(e.target.value))}
              />
              <button
                type="button"
                className="border-border/80 hover:bg-muted/40 size-9 rounded-md border text-lg font-semibold disabled:opacity-40"
                disabled={win.linesRequired >= MAX_BINGO_LINES_REQUIRED}
                onClick={() => setLinesRequired(win.linesRequired + 1)}
                aria-label="Increase lines"
              >
                +
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 accent-[#FFC107]"
              checked={win.includeDiagonals}
              onChange={(e) => setIncludeDiagonals(e.target.checked)}
            />
            Include diagonals as lines
          </label>

          <p className="text-muted-foreground text-sm">{linesHelper}</p>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Teams win only when the entire card is complete — all 25 songs correct.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Bingo win points</Label>
          <Input
            type="number"
            min={0}
            className="bg-background"
            value={config.bingo_line_points ?? 100}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                bingo_line_points: Number(e.target.value) || 0,
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Points per correct song</Label>
          <Input
            type="number"
            min={0}
            className="bg-background"
            value={config.bingo_points_per_correct ?? 10}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                bingo_points_per_correct: Number(e.target.value) || 0,
              }))
            }
          />
        </div>
      </div>

      <div className="inline-grid grid-cols-5 gap-0.5 rounded-lg border p-2">
        {Array.from({ length: 25 }).map((_, i) => {
          const highlight =
            win.mode === 'full_house' || (win.includeDiagonals && diagSet.has(i))
          return (
            <div
              key={i}
              className={cn(
                'aspect-square rounded-sm text-[8px]',
                highlight ? 'bg-[#FFC107]/40' : 'bg-muted/30',
              )}
            />
          )
        })}
      </div>
    </div>
  )
}
