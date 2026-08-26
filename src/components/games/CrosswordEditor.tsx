import { IconCheck, IconClose, IconTrash } from '@/components/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'

import { SegmentedPill } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CROSSWORD_SIZE,
  buildCrosswordLayout,
  detectCrosswordRuns,
  findCrosswordRunAt,
  remapCrosswordClues,
  validateCrosswordWords,
} from '@/lib/puzzle-engine'
import type {
  CrosswordDirection,
  GameConfig,
  PuzzleCrosswordWord,
} from '@/types/game-config'

type Cell = { row: number; col: number }

const GRID: Cell[] = Array.from({ length: CROSSWORD_SIZE }, (_, row) =>
  Array.from({ length: CROSSWORD_SIZE }, (_, col) => ({ row, col })),
).flat()

const CLUE_LIMIT = 120
const colLetter = (col: number) => String.fromCharCode(65 + col)
const runKeyOf = (row: number, col: number, dir: CrosswordDirection) => `${row}-${col}-${dir}`

function lettersMap(placed: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(placed))
}

function initialState(config: GameConfig): {
  placed: Record<string, string>
  clues: Record<string, string>
  blocked: string[]
} {
  const placed: Record<string, string> = {}
  const clues: Record<string, string> = {}
  for (const word of config.puzzle_crossword_words ?? []) {
    Array.from(word.answer.toLocaleLowerCase()).forEach((ch, i) => {
      const row = word.direction === 'down' ? word.row + i : word.row
      const col = word.direction === 'across' ? word.col + i : word.col
      placed[`${row}-${col}`] = ch
    })
    clues[runKeyOf(word.row, word.col, word.direction)] = word.clue
  }
  return {
    placed,
    clues,
    blocked: (config.puzzle_crossword_layout?.blocked ?? []).map((c) => `${c.row}-${c.col}`),
  }
}

export function CrosswordEditor({
  config,
  setConfig,
}: {
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
}) {
  const { t } = useTranslation('admin')
  // Lazy initial state, read once. useState rather than a ref because reading
  // a ref during render is exactly what it looks like: a purity bug waiting.
  const [seed] = useState(() => initialState(config))
  const [placed, setPlaced] = useState<Record<string, string>>(seed.placed)
  const [blocked, setBlocked] = useState<string[]>(seed.blocked)
  const [clues, setClues] = useState<Record<string, string>>(seed.clues)
  const [tool, setTool] = useState<CrosswordDirection | 'block'>('across')
  const [start, setStart] = useState<Cell | null>(null)
  const [dir, setDir] = useState<CrosswordDirection | null>(null)
  const [draft, setDraft] = useState('')
  const [clueTarget, setClueTarget] = useState<string | null>(null)
  const [clueDraft, setClueDraft] = useState('')
  const [sweeping, setSweeping] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const draftInput = useRef<HTMLInputElement>(null)
  const clueInput = useRef<HTMLInputElement>(null)

  const blockedSet = useMemo(() => new Set(blocked), [blocked])

  const runs = useMemo(
    () => detectCrosswordRuns(lettersMap(placed), blockedSet),
    [placed, blockedSet],
  )

  // Every detected run becomes a word, carrying its clue (empty = needs clue).
  const words = useMemo<PuzzleCrosswordWord[]>(
    () =>
      runs.map((run) => {
        const key = runKeyOf(run.row, run.col, run.direction)
        return {
          // The run key (row-col-direction) is already unique within a grid and
          // stable while the word stays put, so it makes a better id than a
          // random UUID kept alive in a mutable map read during render. Ids are
          // opaque downstream: puzzle-engine only passes them through to the
          // player's clue list. Games saved earlier keep their existing UUIDs
          // until the grid is edited again.
          id: key,
          answer: run.answer.toLocaleUpperCase(),
          clue: clues[key] ?? '',
          row: run.row,
          col: run.col,
          direction: run.direction,
        }
      }),
    [runs, clues],
  )

  const blockedCells = useMemo<Cell[]>(
    () => blocked.map((k) => {
      const [row, col] = k.split('-').map(Number)
      return { row, col }
    }),
    [blocked],
  )

  // Push the derived word set and answer-free layout up to the game config.
  useEffect(() => {
    setConfig((current) => ({
      ...current,
      puzzle_crossword_words: words,
      puzzle_crossword_layout: buildCrosswordLayout(words, blockedCells),
    }))
  }, [words, blockedCells, setConfig])

  const needsClue = useMemo(
    () => runs
      .map((run) => runKeyOf(run.row, run.col, run.direction))
      .filter((key) => !(clues[key] ?? '').trim()),
    [runs, clues],
  )

  const validationError =
    words.length > 0 ? validateCrosswordWords(words, blockedCells) : null

  // Reachable run from the start cell in a direction: stops at edge or block.
  function runCells(from: Cell, direction: CrosswordDirection): Cell[] {
    const cells: Cell[] = []
    for (let i = 0; i < CROSSWORD_SIZE; i++) {
      const row = direction === 'down' ? from.row + i : from.row
      const col = direction === 'across' ? from.col + i : from.col
      if (row >= CROSSWORD_SIZE || col >= CROSSWORD_SIZE) break
      if (blockedSet.has(`${row}-${col}`)) break
      cells.push({ row, col })
    }
    return cells
  }

  const acrossRun = start ? runCells(start, 'across') : []
  const downRun = start ? runCells(start, 'down') : []
  const activeRun = dir === 'across' ? acrossRun : dir === 'down' ? downRun : []
  const draftChars = Array.from(draft)

  /**
   * Walks the active run pairing cells with letters. A cell that already holds a
   * letter from a crossing word is locked: it keeps that letter and consumes no
   * typing, so with A fixed in the third square, typing T, E, M spells TEAM.
   */
  const runSlots = activeRun.map((cell) => {
    const key = `${cell.row}-${cell.col}`
    return { cell, key, locked: Boolean(placed[key]), lockedLetter: placed[key] }
  })
  let typedIndex = 0
  const slots = runSlots.map((slot) => {
    if (slot.locked) return { ...slot, letter: slot.lockedLetter ?? '' }
    const letter = draftChars[typedIndex] ?? ''
    typedIndex += 1
    return { ...slot, letter }
  })
  const freeCount = runSlots.filter((slot) => !slot.locked).length
  // Where the next keystroke lands, for the caret.
  const caretKey =
    slots.find((slot) => !slot.locked && !slot.letter)?.key ?? null

  const draftByCell = new Map<string, string>()
  const lockedInRun = new Set<string>()
  if (dir) {
    for (const slot of slots) {
      if (slot.letter) draftByCell.set(slot.key, slot.letter)
      if (slot.locked) lockedInRun.add(slot.key)
    }
  }

  function cancelDraft() {
    setStart(null)
    setDir(null)
    setDraft('')
    setMessage(null)
  }

  function onCellClick(cell: Cell) {
    const key = `${cell.row}-${cell.col}`
    setMessage(null)
    if (tool === 'block') {
      if (placed[key]) {
        setMessage(t('games.crossword.clearBeforeBlock'))
        return
      }
      setBlocked((current) =>
        current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
      )
      return
    }
    if (blockedSet.has(key)) return
    // Clicking away from a part-typed word saves it rather than losing it. A
    // clash stops here so the click does not quietly discard the letters.
    if (dir && start && draftChars.length > 0) {
      if (!confirmWord()) return
    }
    // The pill already carries the direction, so a click both picks the start
    // cell and commits the direction. Checked here rather than left to a
    // disabled button, because there is no longer a second step to disable.
    if (runCells(cell, tool).length < 2) {
      setMessage(
        t(tool === 'across' ? 'games.crossword.noRoomAcross' : 'games.crossword.noRoomDown'),
      )
      return
    }
    setStart(cell)
    setDir(tool)
    setDraft('')
    window.setTimeout(() => draftInput.current?.focus(), 0)
  }

  function confirmWord(): boolean {
    if (!dir || !start || draftChars.length < 1) {
      setMessage(t('games.crossword.minLetters'))
      return false
    }
    let lastFilled = -1
    slots.forEach((slot, index) => {
      if (slot.letter) lastFilled = index
    })
    const wordSlots = slots.slice(0, lastFilled + 1)
    if (wordSlots.some((slot) => !slot.letter)) {
      setMessage(t('games.crossword.fillEverySquare'))
      return false
    }
    const next = { ...placed }
    for (const slot of wordSlots) {
      const letter = slot.letter.toLocaleLowerCase()
      const existing = next[slot.key]
      if (existing && existing !== letter) {
        setMessage(t('games.crossword.letterClash'))
        return false
      }
      next[slot.key] = letter
    }
    setPlaced(next)
    // Words are re-detected from the letters as maximal runs, so the word the
    // player just typed may not start at the clicked cell: letters already
    // sitting before it pull the run's start earlier, and merging runs shift
    // starts too. Ask the fresh layout where each run really begins, let
    // existing clues follow their runs to any new keys, and open the clue box
    // on the run that actually owns the start cell. Keying the clue off the
    // clicked cell instead used to park it under a key no word owns, so the
    // clue typed next silently disappeared.
    const nextRuns = detectCrosswordRuns(lettersMap(next), blockedSet)
    const nextClues = remapCrosswordClues(clues, runs, nextRuns)
    setClues(nextClues)
    setStart(null)
    setDir(null)
    setDraft('')
    const landed =
      findCrosswordRunAt(nextRuns, start.row, start.col, dir) ??
      // A single letter can complete a word in the other direction only, for
      // example an S added under an existing word's last letter.
      findCrosswordRunAt(nextRuns, start.row, start.col, dir === 'across' ? 'down' : 'across')
    if (landed) {
      openClue(runKeyOf(landed.row, landed.col, landed.direction), nextClues)
    }
    return true
  }

  function openClue(key: string, source: Record<string, string> = clues) {
    setClueTarget(key)
    setClueDraft(source[key] ?? '')
    // Deferred like the grid input's focus: works whether the clue box is
    // freshly mounted or already open, which autoFocus alone does not cover.
    window.setTimeout(() => clueInput.current?.focus(), 0)
  }

  // Whatever is in the clue field is committed, never silently dropped. Runs
  // on blur as well as on Save and Enter, so clicking away to start the next
  // word keeps the typed clue.
  function commitClue() {
    if (!clueTarget) return
    const value = clueDraft.trim()
    if (!value) return
    setClues((current) => ({ ...current, [clueTarget]: value }))
  }

  function saveClue() {
    if (!clueTarget || !clueDraft.trim()) return
    commitClue()
    const remaining = needsClue.filter((k) => k !== clueTarget)
    if (sweeping && remaining.length > 0) {
      openClue(remaining[0])
    } else {
      setSweeping(false)
      setClueTarget(null)
      setClueDraft('')
    }
  }

  function removeWord(word: PuzzleCrosswordWord) {
    // Clear only cells owned solely by this word; keep crossing letters.
    const owners = new Map<string, number>()
    for (const run of runs) {
      for (let i = 0; i < Array.from(run.answer).length; i++) {
        const row = run.direction === 'down' ? run.row + i : run.row
        const col = run.direction === 'across' ? run.col + i : run.col
        const k = `${row}-${col}`
        owners.set(k, (owners.get(k) ?? 0) + 1)
      }
    }
    const next = { ...placed }
    const chars = Array.from(word.answer)
    chars.forEach((_, i) => {
      const row = word.direction === 'down' ? word.row + i : word.row
      const col = word.direction === 'across' ? word.col + i : word.col
      const k = `${row}-${col}`
      if ((owners.get(k) ?? 0) <= 1) delete next[k]
    })
    setPlaced(next)
    // Removal can reshape the remaining runs, so their clues follow them.
    const nextRuns = detectCrosswordRuns(lettersMap(next), blockedSet)
    setClues((current) => remapCrosswordClues(current, runs, nextRuns))
    // A clue box left open for the removed word would commit into a key no
    // run owns any more, so it closes with the word.
    if (clueTarget === runKeyOf(word.row, word.col, word.direction)) {
      setSweeping(false)
      setClueTarget(null)
      setClueDraft('')
    }
  }

  function startSweep() {
    if (needsClue.length === 0) return
    setSweeping(true)
    openClue(needsClue[0])
  }

  const wordByRunKey = new Map(
    words.map((w) => [runKeyOf(w.row, w.col, w.direction), w]),
  )
  const needsClueCellKeys = new Set<string>()
  for (const key of needsClue) {
    const word = wordByRunKey.get(key)
    if (!word) continue
    Array.from(word.answer).forEach((_, i) => {
      const row = word.direction === 'down' ? word.row + i : word.row
      const col = word.direction === 'across' ? word.col + i : word.col
      needsClueCellKeys.add(`${row}-${col}`)
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <Label>{t('games.crossword.gridLabel')}</Label>
        <p className="text-muted-foreground mt-1 text-xs">{t('games.crossword.gridHelp')}</p>
      </div>

      <div className="mx-auto w-fit min-w-64">
        <SegmentedPill
          size="sm"
          aria-label={t('games.crossword.toolAria')}
          options={[
            { value: 'across', label: t('games.crossword.across') },
            { value: 'down', label: t('games.crossword.down') },
            { value: 'block', label: t('games.crossword.block') },
          ]}
          value={tool}
          onChange={(next) => {
            setTool(next)
            setMessage(null)
            // Keep the selected cell when swapping across for down, so the
            // choice can be corrected without starting again.
            if (next !== 'block' && start && runCells(start, next).length >= 2) {
              setDir(next)
              setDraft('')
              window.setTimeout(() => draftInput.current?.focus(), 0)
            } else {
              cancelDraft()
            }
          }}
        />
      </div>

      <div className="mx-auto grid w-fit grid-cols-6 gap-1">
        {GRID.map(({ row, col }) => {
          const key = `${row}-${col}`
          const isBlocked = blockedSet.has(key)
          const draftLetter = draftByCell.get(key)
          const letter = draftLetter ?? placed[key]
          const inActive = dir
            ? activeRun.some((c) => c.row === row && c.col === col)
            : false
          const inHighlight = !dir && start
            ? acrossRun.some((c) => c.row === row && c.col === col) ||
              downRun.some((c) => c.row === row && c.col === col)
            : false
          const isStart = start?.row === row && start.col === col
          const needsClueCell = needsClueCellKeys.has(key)
          // Squares already filled by a crossing word, and the one the next
          // keystroke will land in.
          const isLocked = lockedInRun.has(key)
          const isCaret = caretKey === key
          return (
            <button
              key={key}
              type="button"
              aria-label={t('games.crossword.cellAria', {
                row: row + 1,
                column: colLetter(col),
              })}
              onClick={() => onCellClick({ row, col })}
              className={`relative flex size-11 items-center justify-center rounded-md border text-base font-black uppercase transition-colors ${
                isBlocked
                  ? 'border-[#FFC107] bg-[#FFC107] text-transparent'
                  : isLocked
                    ? 'border-[#FFC107] bg-[#FFC107]/55'
                    : isCaret
                      ? 'border-[#FFC107] bg-[#FFC107]/15 ring-2 ring-[#FFC107]'
                      : isStart
                    ? 'border-[#FFC107] bg-[#FFC107]/40'
                    : inActive
                      ? 'border-[#FFC107] bg-[#FFC107]/25'
                      : inHighlight
                        ? 'border-[#FFC107]/70 bg-[#FFC107]/10'
                        : needsClueCell
                          ? 'border-red-400 bg-red-500/10 text-red-600'
                          : letter
                            ? 'border-border bg-muted'
                            : 'border-border/60 bg-background'
              }`}
            >
              {letter?.toLocaleUpperCase() ?? ''}
              {isCaret ? (
                <span
                  aria-hidden
                  className="absolute inset-y-2 left-1/2 w-0.5 animate-pulse bg-[#c79100]"
                />
              ) : null}
            </button>
          )
        })}
      </div>

      {/* Inline typing. The direction came from the pill, so there is no
          direction step between picking a cell and typing. */}
      {tool !== 'block' && start ? (
        <div className="relative flex flex-wrap items-center gap-2">
          <Input
            ref={draftInput}
            value={draft}
            maxLength={freeCount}
            autoComplete="off"
            spellCheck={false}
            aria-label={t('games.crossword.typeWordAria')}
            /* Invisible but still in normal flow, right where it sits in the
               layout. sr-only positions it off screen, so focusing it made the
               browser scroll sideways to reach it and the page jumped. Zero
               size keeps the keystrokes without moving anything. */
            className="pointer-events-none absolute size-0 border-0 p-0 opacity-0"
            style={{ height: 0, width: 0, minHeight: 0 }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                confirmWord()
              }
            }}
            onChange={(event) =>
              setDraft(
                event.target.value
                  .replace(/[^\p{L}]/gu, '')
                  .slice(0, freeCount)
                  .toLocaleUpperCase(),
              )
            }
          />
          <Button type="button" size="sm" disabled={draftChars.length < 2} onClick={confirmWord}>
            <IconCheck className="mr-1 size-4" /> {t('games.crossword.confirm')}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={cancelDraft}>
            <IconClose className="mr-1 size-4" /> {t('common:cancel')}
          </Button>
        </div>
      ) : null}

      {/* Clue box */}
      {clueTarget ? (
        <div className="space-y-2 rounded-lg border p-3">
          <Label>
            {t('games.crossword.clueFor', {
              word: wordByRunKey.get(clueTarget)?.answer ?? t('games.crossword.thisWord'),
            })}
          </Label>
          <div className="flex gap-2">
            <Input
              ref={clueInput}
              value={clueDraft}
              maxLength={CLUE_LIMIT}
              autoFocus
              placeholder={t('games.crossword.cluePlaceholder')}
              className="flex-1 bg-background"
              onChange={(event) => setClueDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  // preventDefault so Enter never falls through to any
                  // surrounding form submit: it commits the clue, full stop.
                  event.preventDefault()
                  saveClue()
                }
              }}
              onBlur={commitClue}
            />
            <Button type="button" size="sm" disabled={!clueDraft.trim()} onClick={saveClue}>
              {t('common:save')}
            </Button>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-xs font-medium text-red-600">{message}</p> : null}

      {words.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('games.crossword.wordsAndClues')}</Label>
            {needsClue.length > 0 ? (
              <Button type="button" size="sm" variant="outline" onClick={startSweep}>
                {t('games.crossword.addMissingClues', { total: needsClue.length })}
              </Button>
            ) : null}
          </div>
          {words.map((word) => {
            const key = runKeyOf(word.row, word.col, word.direction)
            const missing = !(clues[key] ?? '').trim()
            return (
              <div key={word.id} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground w-14 shrink-0 text-xs">
                  R{word.row + 1}{colLetter(word.col)}{' '}
                  {word.direction === 'across' ? '→' : '↓'}
                </span>
                <button
                  type="button"
                  onClick={() => openClue(key)}
                  className={`w-24 shrink-0 text-left font-bold uppercase tracking-wide ${
                    missing ? 'text-red-600' : 'text-[#B8860B]'
                  }`}
                >
                  {word.answer}
                </button>
                <span className="text-muted-foreground min-w-0 flex-1 truncate">
                  {missing ? t('games.crossword.needsClue') : word.clue}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('games.crossword.removeWord', { word: word.answer })}
                  onClick={() => removeWord(word)}
                >
                  <IconTrash className="size-4" />
                </Button>
              </div>
            )
          })}
        </div>
      ) : null}

      {validationError ? (
        <p className="text-xs font-medium text-amber-600">{validationError}</p>
      ) : null}
    </div>
  )
}
