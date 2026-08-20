import { IconGrid, IconPlus, IconPuzzle, IconRows, IconTrash } from '@/components/icons'
import { useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'

import { CrosswordEditor } from '@/components/games/CrosswordEditor'
import { SegmentedPill } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { newMatchingPair, puzzleType, validatePuzzleConfig } from '@/lib/puzzle-engine'
import type { GameConfig, PuzzleType } from '@/types/game-config'

/** Six keeps the preview on one row at any width. */
const WORDLE_MAX_LETTERS = 6

const MAX_PAIRS = 12

const SUBTYPES: {
  type: PuzzleType
  nameKey: string
  icon: typeof IconGrid
  upcoming?: boolean
}[] = [
  { type: 'wordle', nameKey: 'games.puzzle.types.wordle', icon: IconGrid },
  { type: 'matching', nameKey: 'games.puzzle.types.matching', icon: IconRows },
  { type: 'crossword', nameKey: 'games.puzzle.types.crossword', icon: IconPuzzle },
]

export function PuzzleEditor({
  config,
  setConfig,
  section = 'designer',
}: {
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
  /** 'settings' renders the type picker; 'designer' renders the builder. */
  section?: 'settings' | 'designer'
}) {
  const { t } = useTranslation('admin')
  const selected = puzzleType(config)
  const [wordleHint, setWordleHint] = useState<string | null>(null)
  const pairs = config.puzzle_matching_pairs ?? [
    newMatchingPair('France', 'Paris'),
    newMatchingPair('Italy', 'Rome'),
  ]

  function selectSubtype(type: PuzzleType) {
    setConfig((current) => ({
      ...current,
      puzzle_type: type,
      puzzle_wordle_answer: current.puzzle_wordle_answer ?? 'TEAM',
      puzzle_matching_pairs:
        current.puzzle_matching_pairs ?? [newMatchingPair(), newMatchingPair()],
      puzzle_crossword_words: current.puzzle_crossword_words ?? [],
    }))
  }

  // The style picker sits in Primary settings, so the choice is made with the
  // rest of the game's basics; the designer for that choice lives on the right.
  if (section === 'settings') {
    return (
      <div className="space-y-2">
        <Label>{t('games.puzzle.typeLabel')}</Label>
        <SegmentedPill
          aria-label={t('games.puzzle.styleAria')}
          options={SUBTYPES.map(({ type, nameKey, upcoming }) => ({
            value: type,
            label: t(nameKey),
            disabled: upcoming,
          }))}
          value={selected}
          onChange={(next) => selectSubtype(next)}
        />
      </div>
    )
  }

  return (
    <Card className="border-border/80 space-y-6 bg-card p-5 shadow-sm sm:p-6">
      <h3 className="text-foreground text-sm font-bold">{t('games.puzzle.designerTitle')}</h3>

      {selected === 'wordle' || selected === 'crossword' ? (
        <div className="flex flex-wrap items-center gap-3">
          <Label className="shrink-0">{t('games.puzzle.playerKeyboard')}</Label>
          <div className="bg-muted grid grid-cols-2 gap-1 rounded-full p-1">
            <Button
              type="button"
              size="sm"
              variant={(config.puzzle_keyboard_alphabet ?? 'latin') === 'latin' ? 'default' : 'ghost'}
              className="rounded-full"
              onClick={() =>
                setConfig((current) => ({ ...current, puzzle_keyboard_alphabet: 'latin' }))
              }
            >
              {t('games.puzzle.latin')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={config.puzzle_keyboard_alphabet === 'cyrillic' ? 'default' : 'ghost'}
              className="rounded-full"
              onClick={() =>
                setConfig((current) => ({ ...current, puzzle_keyboard_alphabet: 'cyrillic' }))
              }
            >
              {t('games.puzzle.cyrillic')}
            </Button>
          </div>
        </div>
      ) : null}

      {selected === 'wordle' ? (
        <div className="space-y-4">
          <div className="flex w-full flex-wrap items-center gap-3">
            <Label htmlFor="puzzle-wordle-answer" className="shrink-0">
              {t('games.puzzle.answer')}
            </Label>
            <Input
              id="puzzle-wordle-answer"
              value={config.puzzle_wordle_answer ?? ''}
              maxLength={WORDLE_MAX_LETTERS}
              autoComplete="off"
              spellCheck={false}
              className="bg-background w-48 text-lg font-bold uppercase tracking-[0.2em]"
              placeholder="TEAM"
              onChange={(event) => {
                // Truncated here as well as by maxLength: the attribute only
                // stops typing and pasting, so anything set another way could
                // still push a longer answer into the config.
                const cleaned = Array.from(
                  event.target.value.replace(/[^\p{L}]/gu, '').toLocaleUpperCase(),
                )
                  .slice(0, WORDLE_MAX_LETTERS)
                  .join('')
                // maxLength stops typing silently; say why rather than just
                // refusing the keystroke.
                setWordleHint(
                  Array.from(cleaned).length >= WORDLE_MAX_LETTERS
                    ? t('games.puzzle.maxLetters', { max: WORDLE_MAX_LETTERS })
                    : null,
                )
                setConfig((current) => ({ ...current, puzzle_wordle_answer: cleaned }))
              }}
            />
            <span className="text-muted-foreground text-xs">
              {wordleHint ?? t('games.puzzle.upToLetters', { max: WORDLE_MAX_LETTERS })}
            </span>
          </div>

          <div className="border-border bg-muted/25 rounded-md border p-4">
            <p className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-[0.1em] uppercase">
              {t('games.puzzle.playerPreview')}
            </p>
            <div className="flex justify-center gap-2">
              {Array.from(config.puzzle_wordle_answer || 'TEAM').map((letter, index) => (
                <span
                  key={`${letter}-${index}`}
                  className="border-nm-slate-400 bg-card flex size-12 items-center justify-center rounded border text-lg font-bold uppercase"
                >
                  {letter || ' '}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {selected === 'matching' ? (
        <div className="space-y-4">
          <Label>{t('games.puzzle.matchingPairs')}</Label>

          <div className="border-border bg-muted/20 space-y-2 rounded-md border p-3">
            <div className="text-muted-foreground grid grid-cols-[1fr_1fr_2.5rem] gap-2 px-1 text-xs font-semibold uppercase tracking-wide">
              <span>{t('games.puzzle.left')}</span>
              <span>{t('games.puzzle.matchesWith')}</span>
              <span />
            </div>
            {pairs.map((pair, index) => (
              <div key={pair.id} className="grid grid-cols-[1fr_1fr_2.5rem] gap-2">
                <Input
                  value={pair.left}
                  maxLength={100}
                  className="bg-background"
                  placeholder={t('games.puzzle.leftNumbered', { number: index + 1 })}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      puzzle_matching_pairs: (current.puzzle_matching_pairs ?? pairs).map((item) =>
                        item.id === pair.id ? { ...item, left: event.target.value } : item,
                      ),
                    }))
                  }
                />
                <Input
                  value={pair.right}
                  maxLength={100}
                  className="bg-background"
                  placeholder={t('games.puzzle.rightNumbered', { number: index + 1 })}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      puzzle_matching_pairs: (current.puzzle_matching_pairs ?? pairs).map((item) =>
                        item.id === pair.id ? { ...item, right: event.target.value } : item,
                      ),
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={pairs.length <= 2}
                  aria-label={t('games.puzzle.removePair', { number: index + 1 })}
                  onClick={() =>
                    setConfig((current) => ({
                      ...current,
                      puzzle_matching_pairs: (current.puzzle_matching_pairs ?? pairs).filter(
                        (item) => item.id !== pair.id,
                      ),
                    }))
                  }
                >
                  <IconTrash className="size-4" />
                </Button>
              </div>
            ))}
            {/* Inside the box, under the last pair: adding one continues the
                list rather than reaching back up to a separate button. */}
            {pairs.length < MAX_PAIRS ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-full justify-center"
                onClick={() =>
                  setConfig((current) => ({
                    ...current,
                    puzzle_matching_pairs: [
                      ...(current.puzzle_matching_pairs ?? pairs),
                      newMatchingPair(),
                    ],
                  }))
                }
              >
                <IconPlus className="mr-1 size-4" /> {t('games.puzzle.addMore')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {selected === 'crossword' ? (
        <CrosswordEditor config={config} setConfig={setConfig} />
      ) : null}
    </Card>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- validation is shared by new/edit pages
export { validatePuzzleConfig }
