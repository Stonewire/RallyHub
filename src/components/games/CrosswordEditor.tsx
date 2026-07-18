import { ArrowDown, ArrowRight, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CROSSWORD_SIZE,
  buildCrosswordLayout,
  crosswordCellLetters,
  crosswordWordCells,
  validateCrosswordWords,
} from '@/lib/puzzle-engine'
import type {
  CrosswordDirection,
  GameConfig,
  PuzzleCrosswordWord,
} from '@/types/game-config'

const GRID = Array.from({ length: CROSSWORD_SIZE }, (_, row) =>
  Array.from({ length: CROSSWORD_SIZE }, (_, col) => ({ row, col })),
)

export function CrosswordEditor({
  config,
  setConfig,
}: {
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
}) {
  const words = useMemo(() => config.puzzle_crossword_words ?? [], [config.puzzle_crossword_words])
  const [start, setStart] = useState<{ row: number; col: number } | null>(null)
  const [direction, setDirection] = useState<CrosswordDirection>('across')
  const [draftAnswer, setDraftAnswer] = useState('')
  const [draftClue, setDraftClue] = useState('')

  const { letters, conflicts } = useMemo(() => crosswordCellLetters(words), [words])
  const validationError = words.length > 0 ? validateCrosswordWords(words) : null

  function commitWords(next: PuzzleCrosswordWord[]) {
    setConfig((current) => ({
      ...current,
      puzzle_crossword_words: next,
      puzzle_crossword_layout: buildCrosswordLayout(next),
    }))
  }

  const draftCells =
    start && draftAnswer
      ? crosswordWordCells({
          id: 'draft',
          answer: draftAnswer,
          clue: '',
          row: start.row,
          col: start.col,
          direction,
        })
      : []
  const draftOutOfBounds = draftCells.some(
    (cell) => cell.row >= CROSSWORD_SIZE || cell.col >= CROSSWORD_SIZE,
  )
  const canAdd =
    start !== null &&
    Array.from(draftAnswer).length >= 2 &&
    draftClue.trim().length > 0 &&
    !draftOutOfBounds

  function addWord() {
    if (!start || !canAdd) return
    commitWords([
      ...words,
      {
        id: crypto.randomUUID(),
        answer: draftAnswer,
        clue: draftClue.trim(),
        row: start.row,
        col: start.col,
        direction,
      },
    ])
    setDraftAnswer('')
    setDraftClue('')
    setStart(null)
  }

  return (
    <div className="space-y-5">
      <div>
        <Label>Crossword grid</Label>
        <p className="text-muted-foreground mt-1 text-xs">
          Tap a start cell, pick a direction, type the word and its clue, then add it.
          Words are 2 to {CROSSWORD_SIZE} letters and every word must cross another.
        </p>
      </div>

      <div className="mx-auto grid w-fit grid-cols-5 gap-1">
        {GRID.flat().map(({ row, col }) => {
          const key = `${row}-${col}`
          const letter = letters.get(key)
          const isDraft = draftCells.some((cell) => cell.row === row && cell.col === col)
          const isStart = start?.row === row && start.col === col
          return (
            <button
              key={key}
              type="button"
              aria-label={`Cell row ${row + 1}, column ${col + 1}`}
              onClick={() => setStart({ row, col })}
              className={`flex size-11 items-center justify-center rounded-md border text-base font-black uppercase transition-colors ${
                conflicts.has(key)
                  ? 'border-red-500 bg-red-500/20 text-red-600'
                  : isStart
                    ? 'border-[#FFC107] bg-[#FFC107]/25'
                    : isDraft
                      ? 'border-[#FFC107]/70 bg-[#FFC107]/10'
                      : letter
                        ? 'border-border bg-muted'
                        : 'border-border/60 bg-background'
              }`}
            >
              {letter?.toLocaleUpperCase() ?? ''}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={direction === 'across' ? 'default' : 'outline'}
            onClick={() => setDirection('across')}
          >
            <ArrowRight className="mr-1 size-4" /> Across
          </Button>
          <Button
            type="button"
            size="sm"
            variant={direction === 'down' ? 'default' : 'outline'}
            onClick={() => setDirection('down')}
          >
            <ArrowDown className="mr-1 size-4" /> Down
          </Button>
        </div>
        <Input
          value={draftAnswer}
          maxLength={CROSSWORD_SIZE}
          autoComplete="off"
          spellCheck={false}
          placeholder="WORD"
          className="w-28 bg-background font-bold uppercase tracking-[0.15em]"
          onChange={(event) =>
            setDraftAnswer(event.target.value.replace(/[^\p{L}]/gu, '').toLocaleUpperCase())
          }
        />
        <Input
          value={draftClue}
          maxLength={200}
          placeholder="Clue for this word"
          className="min-w-48 flex-1 bg-background"
          onChange={(event) => setDraftClue(event.target.value)}
        />
        <Button type="button" size="sm" disabled={!canAdd} onClick={addWord}>
          <Plus className="mr-1 size-4" /> Add word
        </Button>
      </div>
      {start === null ? (
        <p className="text-muted-foreground text-xs">
          Tap a grid cell to choose where the word starts.
        </p>
      ) : draftOutOfBounds ? (
        <p className="text-xs font-medium text-red-600">
          That word does not fit from the selected cell.
        </p>
      ) : null}

      {words.length > 0 ? (
        <div className="space-y-2">
          <Label>Words and clues</Label>
          {words.map((word) => (
            <div key={word.id} className="flex items-center gap-2 text-sm">
              <span className="w-20 shrink-0 font-bold uppercase tracking-wide">{word.answer}</span>
              <span className="text-muted-foreground w-16 shrink-0 text-xs">
                {word.direction === 'across' ? 'Across' : 'Down'} R{word.row + 1}C{word.col + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{word.clue}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${word.answer}`}
                onClick={() => commitWords(words.filter((item) => item.id !== word.id))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {validationError ? (
        <p className="text-xs font-medium text-amber-600">{validationError}</p>
      ) : null}
    </div>
  )
}
