import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'

import { SegmentedPill } from '@/components/neo-minimal'
import { Label } from '@/components/ui/label'
import { NumberField } from '@/components/ui/number-field'
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
  const { t } = useTranslation('admin')
  const win = resolveBingoWinConfig(config)

  function setLinesRequired(n: number) {
    setConfig((c) => ({ ...c, bingo_win_mode: 'lines', bingo_lines_required: clamp(n) }))
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>{t('games.bingo.winningConditions')}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="border-border/80 hover:bg-muted/40 size-8 rounded-md border text-lg font-semibold disabled:opacity-40"
            disabled={win.linesRequired <= MIN_BINGO_LINES_REQUIRED}
            onClick={() => setLinesRequired(win.linesRequired - 1)}
            aria-label={t('games.bingo.decreaseLines')}
          >
            −
          </button>
          <NumberField
            min={MIN_BINGO_LINES_REQUIRED}
            max={MAX_BINGO_LINES_REQUIRED}
            aria-label={t('games.bingo.linesRequiredToWin')}
            className="bg-background h-8 w-16 text-center"
            value={win.linesRequired}
            onChange={setLinesRequired}
          />
          <button
            type="button"
            className="border-border/80 hover:bg-muted/40 size-8 rounded-md border text-lg font-semibold disabled:opacity-40"
            disabled={win.linesRequired >= MAX_BINGO_LINES_REQUIRED}
            onClick={() => setLinesRequired(win.linesRequired + 1)}
            aria-label={t('games.bingo.increaseLines')}
          >
            +
          </button>
          <span className="text-muted-foreground text-xs">
            {t('games.bingo.linesToWin', { count: win.linesRequired })}
          </span>

          <span className="text-muted-foreground ml-1 text-xs">{t('games.bingo.diagonals')}</span>
          <SegmentedPill
            size="sm"
            className="w-24"
            aria-label={t('games.bingo.countDiagonals')}
            options={[
              { value: 'no', label: t('games.no') },
              { value: 'yes', label: t('games.yes') },
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
          <Label>{t('games.bingo.winPoints')}</Label>
          <NumberField
            min={0}
            className="bg-background h-8"
            value={config.bingo_line_points ?? 100}
            onChange={(n) => setConfig((c) => ({ ...c, bingo_line_points: n }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('games.bingo.pointsPerCorrectSong')}</Label>
          <NumberField
            min={0}
            className="bg-background h-8"
            value={config.bingo_points_per_correct ?? 10}
            onChange={(n) => setConfig((c) => ({ ...c, bingo_points_per_correct: n }))}
          />
        </div>
      </div>
    </div>
  )
}
