import type { Dispatch, SetStateAction } from 'react'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  ALL_BINGO_LINES,
  defaultWinningLines,
  lineKey,
} from '@/lib/bingo-lines'
import { cn } from '@/lib/utils'
import type { GameConfig } from '@/types/game-config'

const ROW_LABELS = ['R1', 'R2', 'R3', 'R4', 'R5']
const COL_LABELS = ['C1', 'C2', 'C3', 'C4', 'C5']

type BingoWinningComboEditorProps = {
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
}

function selectedKeys(config: GameConfig): Set<string> {
  const lines = config.bingo_winning_lines ?? defaultWinningLines()
  return new Set(lines.map(lineKey))
}

export function BingoWinningComboEditor({ config, setConfig }: BingoWinningComboEditorProps) {
  const selected = selectedKeys(config)

  function toggleLine(line: number[]) {
    const key = lineKey(line)
    setConfig((c) => {
      const current = c.bingo_winning_lines ?? defaultWinningLines()
      const keys = new Set(current.map(lineKey))
      if (keys.has(key)) keys.delete(key)
      else keys.add(key)
      const next = ALL_BINGO_LINES.filter((l) => keys.has(lineKey(l)))
      return {
        ...c,
        bingo_winning_lines: next.length ? next : defaultWinningLines(),
      }
    })
  }

  const rows = ALL_BINGO_LINES.slice(0, 5)
  const cols = ALL_BINGO_LINES.slice(5, 10)
  const diags = ALL_BINGO_LINES.slice(10, 12)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-foreground font-semibold">Winning combo</h3>
        <p className="text-muted-foreground text-sm">
          Click rows or columns that count as bingo. Teams earn line points when they fill any
          selected line with correct songs.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {rows.map((line, i) => (
          <button
            key={lineKey(line)}
            type="button"
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm font-medium',
              selected.has(lineKey(line))
                ? 'border-[#FFCB03] bg-[#FFCB03]/20'
                : 'border-border/80 hover:bg-muted/40',
            )}
            onClick={() => toggleLine(line)}
          >
            Row {ROW_LABELS[i]}
          </button>
        ))}
        {cols.map((line, i) => (
          <button
            key={lineKey(line)}
            type="button"
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm font-medium',
              selected.has(lineKey(line))
                ? 'border-[#FFCB03] bg-[#FFCB03]/20'
                : 'border-border/80 hover:bg-muted/40',
            )}
            onClick={() => toggleLine(line)}
          >
            Col {COL_LABELS[i]}
          </button>
        ))}
        {diags.map((line, i) => (
          <button
            key={lineKey(line)}
            type="button"
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm font-medium',
              selected.has(lineKey(line))
                ? 'border-[#FFCB03] bg-[#FFCB03]/20'
                : 'border-border/80 hover:bg-muted/40',
            )}
            onClick={() => toggleLine(line)}
          >
            Diag {i + 1}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Bingo line points</Label>
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
          const inLine = ALL_BINGO_LINES.some(
            (line) => selected.has(lineKey(line)) && line.includes(i),
          )
          return (
            <div
              key={i}
              className={cn(
                'aspect-square rounded-sm text-[8px]',
                inLine ? 'bg-[#FFCB03]/40' : 'bg-muted/30',
              )}
            />
          )
        })}
      </div>
    </div>
  )
}
