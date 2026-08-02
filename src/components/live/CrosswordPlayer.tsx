import { Check, Lightbulb, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { VirtualKeyboard } from '@/components/live/VirtualKeyboard'
import {
  publishLiveBundleReload,
  publishPuzzleProgressChange,
  subscribeLiveBundleBroadcast,
} from '@/lib/live-broadcast'
import { getCurrentParticipantSession } from '@/lib/participant-session'
import { crosswordScore, parsePuzzleProgress, type PuzzleProgress } from '@/lib/puzzle-engine'
import { supabase } from '@/lib/supabase'
import type { CrosswordClue, GameConfig } from '@/types/game-config'
import type { Json } from '@/types/json'
import type { Tables } from '@/types/helpers'

type Props = {
  eventId: string
  teamId: string
  game: Tables<'games'>
  accentColor: string
}

const GRID_SIZE = 6
const SOLVE_WINDOW = 300 // seconds at full points

function formatClock(seconds: number): string {
  const sign = seconds < 0 ? '-' : ''
  const abs = Math.abs(Math.floor(seconds))
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`
}

function clueCells(clue: CrosswordClue): string[] {
  return Array.from({ length: clue.length }, (_, i) =>
    clue.direction === 'down' ? `${clue.row + i}-${clue.col}` : `${clue.row}-${clue.col + i}`,
  )
}

export function CrosswordPlayer({ eventId, teamId, game, accentColor }: Props) {
  const config = (game.config ?? {}) as GameConfig
  const layout = config.puzzle_crossword_layout
  const maxPoints = Math.max(1, game.points_static ?? 100)
  const session = getCurrentParticipantSession()
  const teamToken =
    session?.eventId === eventId && session.teamId === teamId ? session.purchaseToken : undefined

  const [progress, setProgress] = useState<PuzzleProgress | null>(null)
  const [cells, setCells] = useState<Record<string, string>>({})
  const [activeClueId, setActiveClueId] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [panelCell, setPanelCell] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [wrongFlash, setWrongFlash] = useState(false)
  const syncTimer = useRef<number | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)

  const clues = useMemo(() => layout?.clues ?? [], [layout])
  const openKeys = useMemo(
    () => new Set((layout?.cells ?? []).map(({ row, col }) => `${row}-${col}`)),
    [layout],
  )
  const blockedKeys = useMemo(
    () => new Set((layout?.blocked ?? []).map(({ row, col }) => `${row}-${col}`)),
    [layout],
  )
  // Keyed by every cell a word passes through, not just its first cell, so
  // tapping anywhere in a word shows that word's clue.
  const cluesByCell = useMemo(() => {
    const map = new Map<string, CrosswordClue[]>()
    for (const clue of clues) {
      for (const key of clueCells(clue)) {
        map.set(key, [...(map.get(key) ?? []), clue])
      }
    }
    return map
  }, [clues])
  const startNumbers = useMemo(() => {
    const map = new Map<string, number>()
    for (const clue of clues) {
      if (!map.has(`${clue.row}-${clue.col}`)) map.set(`${clue.row}-${clue.col}`, clue.number)
    }
    return map
  }, [clues])

  const solvedWordIds = useMemo(() => new Set(progress?.solvedWordIds ?? []), [progress])
  const revealedKeys = useMemo(
    () => new Set(Object.keys(progress?.revealedCells ?? {})),
    [progress],
  )
  const solvedCellKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const clue of clues) {
      if (solvedWordIds.has(clue.id)) clueCells(clue).forEach((k) => keys.add(k))
    }
    return keys
  }, [clues, solvedWordIds])

  const activeClue = clues.find((c) => c.id === activeClueId) ?? null
  const activeCells = activeClue ? clueCells(activeClue) : []

  const applyProgress = useCallback((next: PuzzleProgress) => {
    setProgress(next)
    setCells((current) =>
      next.completed
        ? next.filledCells
        : { ...next.filledCells, ...current, ...next.revealedCells },
    )
  }, [])

  const tokenMissing = !teamToken

  // Read first, and only register a fill row when the team has not started yet.
  // `update_crossword_fill` REPLACES filled_cells, so calling it with {} on every
  // mount used to wipe a half-finished grid whenever a player left the game and
  // came back (or their phone reloaded) while the solve timer kept running.
  useEffect(() => {
    if (!teamToken) return
    let cancelled = false
    void (async () => {
      const args = {
        p_event_id: eventId,
        p_game_id: game.id,
        p_team_token: teamToken,
      }
      const { data: existing, error: readError } = await supabase.rpc(
        'get_team_puzzle_progress',
        args,
      )
      if (cancelled) return
      if (readError) {
        setError(readError.message)
        setLoading(false)
        return
      }
      const parsed = parsePuzzleProgress(existing as Json)
      if (parsed.startedAt) {
        applyProgress(parsed)
        setError(null)
        setLoading(false)
        return
      }
      // No row yet: this write creates it, which is what starts the solve timer.
      const { data, error: startError } = await supabase.rpc('update_crossword_fill', {
        ...args,
        p_cells: {},
      })
      if (cancelled) return
      if (startError) setError(startError.message)
      else {
        applyProgress(parsePuzzleProgress(data as Json))
        setError(null)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [applyProgress, eventId, game.id, teamToken])

  useEffect(
    () =>
      subscribeLiveBundleBroadcast(eventId, {
        onBundlePatch: (patch) => {
          if (
            patch.kind === 'puzzle_progress' &&
            patch.teamId === teamId &&
            patch.gameId === game.id &&
            teamToken
          ) {
            void supabase
              .rpc('get_team_puzzle_progress', {
                p_event_id: eventId,
                p_game_id: game.id,
                p_team_token: teamToken,
              })
              .then(({ data }) => {
                if (data) applyProgress(parsePuzzleProgress(data as Json))
              })
          }
        },
      }),
    [applyProgress, eventId, game.id, teamId, teamToken],
  )

  // The board is what the team came here for, so it opens ready to play:
  // scrolled past the cover and brief, sitting clear above the keyboard. The
  // cover is still there to scroll back up to.
  useEffect(() => {
    const id = window.setTimeout(() => {
      boardRef.current?.scrollIntoView({ block: 'start' })
    }, 120)
    return () => window.clearTimeout(id)
  }, [game.id])

  // Live clock tick while unsolved.
  useEffect(() => {
    if (progress?.completed) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [progress?.completed])

  const syncFill = useCallback(
    (nextCells: Record<string, string>) => {
      if (!teamToken) return
      if (syncTimer.current !== null) window.clearTimeout(syncTimer.current)
      syncTimer.current = window.setTimeout(() => {
        void supabase
          .rpc('update_crossword_fill', {
            p_event_id: eventId,
            p_game_id: game.id,
            p_team_token: teamToken,
            p_cells: nextCells,
          })
          .then(() => publishPuzzleProgressChange(eventId, teamId, game.id))
      }, 700)
    },
    [eventId, game.id, teamId, teamToken],
  )

  const checkWord = useCallback(
    async (nextCells: Record<string, string>, wordId: string) => {
      if (!teamToken || checking) return
      setChecking(true)
      try {
        const { data, error: checkError } = await supabase.rpc('validate_crossword_grid', {
          p_event_id: eventId,
          p_game_id: game.id,
          p_team_token: teamToken,
          p_cells: nextCells,
        })
        if (checkError) throw checkError
        const next = parsePuzzleProgress(data as Json)
        applyProgress(next)
        void publishPuzzleProgressChange(eventId, teamId, game.id)
        if (next.completed) {
          void publishLiveBundleReload(eventId)
        } else if (!next.solvedWordIds.includes(wordId)) {
          setWrongFlash(true)
          window.setTimeout(() => setWrongFlash(false), 900)
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Could not check the crossword.')
      } finally {
        setChecking(false)
      }
    },
    [applyProgress, checking, eventId, game.id, teamId, teamToken],
  )

  const useHint = useCallback(async () => {
    if (!teamToken) return
    try {
      const { data, error: hintError } = await supabase.rpc('use_crossword_hint', {
        p_event_id: eventId,
        p_game_id: game.id,
        p_team_token: teamToken,
        p_cells: cells,
      })
      if (hintError) throw hintError
      applyProgress(parsePuzzleProgress(data as Json))
      void publishPuzzleProgressChange(eventId, teamId, game.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not use a hint.')
    }
  }, [applyProgress, cells, eventId, game.id, teamId, teamToken])

  function isLocked(key: string) {
    return solvedCellKeys.has(key) || revealedKeys.has(key)
  }

  function handleKey(letter: string) {
    if (checking || !activeClue) return
    const key = activeCells[activeIndex]
    if (!key || isLocked(key)) return
    const nextCells = { ...cells, [key]: letter.toLocaleUpperCase() }
    setCells(nextCells)
    setError(null)
    syncFill(nextCells)
    const nextIndex = activeCells.findIndex((k, i) => i > activeIndex && !isLocked(k))
    if (nextIndex !== -1) setActiveIndex(nextIndex)
    if (activeCells.every((k) => nextCells[k])) {
      void checkWord(nextCells, activeClue.id)
    }
  }

  function handleBackspace() {
    if (checking || !activeClue) return
    const key = activeCells[activeIndex]
    if (key && cells[key] && !isLocked(key)) {
      const nextCells = { ...cells }
      delete nextCells[key]
      setCells(nextCells)
      syncFill(nextCells)
      return
    }
    const prevIndex = [...activeCells.keys()]
      .slice(0, activeIndex)
      .reverse()
      .find((i) => !isLocked(activeCells[i]))
    if (prevIndex === undefined) return
    const prevKey = activeCells[prevIndex]
    const nextCells = { ...cells }
    delete nextCells[prevKey]
    setCells(nextCells)
    syncFill(nextCells)
    setActiveIndex(prevIndex)
  }

  function selectCell(key: string) {
    const here = cluesByCell.get(key) ?? []
    if (here.length === 0) return
    setPanelCell(key)
    // Tapping the cursor cell again at a crossing swaps across/down, the way a
    // normal crossword behaves. Otherwise keep the word already being typed.
    const alreadyActive = activeClue && here.some((c) => c.id === activeClue.id)
    const clue =
      alreadyActive && here.length > 1 && activeCells[activeIndex] === key
        ? (here.find((c) => c.id !== activeClue.id) ?? activeClue)
        : alreadyActive
          ? activeClue
          : here[0]
    setActiveClueId(clue.id)
    const index = clueCells(clue).indexOf(key)
    setActiveIndex(index === -1 ? 0 : index)
  }

  if (!layout || openKeys.size === 0) {
    return <p className="py-8 text-white/70">This crossword is not configured yet.</p>
  }

  if (tokenMissing) {
    return (
      <p className="rounded-xl bg-red-950/70 px-4 py-3 text-sm text-red-100" role="alert">
        Rejoin this event on this phone once to enable secure puzzle play.
      </p>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-white/75">
        <Loader2 className="size-5 animate-spin" /> Loading crossword…
      </div>
    )
  }

  if (progress?.completed) {
    return (
      <div className="xp-glass-panel rounded-2xl bg-black/30 p-8 text-center">
        <Check className="mx-auto size-12 text-green-400" />
        <p className="mt-3 text-2xl font-black">Crossword complete!</p>
        <p className="mt-2 text-lg font-semibold" style={{ color: accentColor }}>
          +{progress.pointsAwarded ?? 0} points
        </p>
        {progress.solveSeconds !== null ? (
          <p className="mt-2 text-sm text-white/65">Solved in {formatClock(progress.solveSeconds)}</p>
        ) : null}
      </div>
    )
  }

  const startedAt = progress?.startedAt ? Date.parse(progress.startedAt) : null
  const elapsed = startedAt ? Math.max(0, (now - startedAt) / 1000) : 0
  const remaining = SOLVE_WINDOW - elapsed
  const hintsUsed = progress?.hintsUsed ?? 0
  const livePoints = crosswordScore(maxPoints, elapsed, hintsUsed)
  const clockColor =
    remaining < 0 ? 'text-red-400' : remaining <= 60 ? 'text-amber-300' : 'text-green-400'

  return (
    // Bottom room for the fixed keyboard: scrolled all the way down, every
    // clue and cell still sits above it rather than behind it.
    <div ref={boardRef} className="scroll-mt-3 space-y-4 pb-[20rem]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-2xl font-black tabular-nums ${clockColor}`}>{formatClock(remaining)}</p>
          <p className="text-xs text-white/60">Time left</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black tabular-nums" style={{ color: accentColor }}>
            {livePoints}
          </p>
          <p className="text-xs text-white/60">Points if solved now</p>
        </div>
        <button
          type="button"
          onClick={useHint}
          disabled={hintsUsed >= 3}
          className="flex flex-col items-center rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-white disabled:opacity-40"
        >
          <Lightbulb className="size-5" />
          <span className="mt-0.5 text-xs font-semibold">Hint {3 - hintsUsed}</span>
        </button>
      </div>

      <div
        className={`mx-auto grid w-fit grid-cols-6 gap-1 transition-transform ${
          wrongFlash ? 'animate-pulse' : ''
        }`}
      >
        {Array.from({ length: GRID_SIZE }, (_, row) =>
          Array.from({ length: GRID_SIZE }, (_, col) => {
            const key = `${row}-${col}`
            if (blockedKeys.has(key)) {
              return <span key={key} className="size-12 rounded-md bg-[#FFC107]" />
            }
            if (!openKeys.has(key)) {
              return <span key={key} className="size-12 rounded-md bg-black/50" />
            }
            const number = startNumbers.get(key)
            const solved = solvedCellKeys.has(key)
            const revealed = revealedKeys.has(key)
            const locked = solved || revealed
            const inActive = activeCells.includes(key)
            const isCursor = inActive && !locked && activeCells[activeIndex] === key
            return (
              <span key={key} className="relative">
                {number ? (
                  <span className="absolute top-0.5 left-1 z-10 text-[9px] font-bold text-white/70">
                    {number}
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={checking}
                  onClick={() => selectCell(key)}
                  aria-label={`Row ${row + 1} column ${col + 1}`}
                  className={`size-12 rounded-md border-2 text-center text-lg font-black uppercase ${
                    solved
                      ? 'border-green-400/70 bg-green-500/25 text-green-100'
                      : revealed
                        ? 'border-amber-300/70 bg-amber-400/20 text-amber-100'
                        : inActive
                          ? 'border-white/70 bg-white/20 text-white'
                          : 'border-white/30 bg-white/10 text-white'
                  } ${number && !locked && !inActive ? 'ring-2 ring-inset ring-[#FFC107]/60' : ''} ${
                    isCursor ? 'ring-2 ring-white' : ''
                  } ${wrongFlash && inActive ? 'border-red-400/80' : ''}`}
                >
                  {locked ? (progress?.filledCells[key] ?? cells[key] ?? '') : (cells[key] ?? '')}
                </button>
              </span>
            )
          }),
        )}
      </div>

      {panelCell && cluesByCell.get(panelCell)?.length ? (
        <div className="rounded-xl bg-black/30 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-white/60">
            {(cluesByCell.get(panelCell) ?? []).length > 1 ? 'Clues here' : 'Clue'}
          </p>
          <div className="mt-2 space-y-1">
            {(cluesByCell.get(panelCell) ?? []).map((clue) => (
              <button
                key={clue.id}
                type="button"
                onClick={() => {
                  setActiveClueId(clue.id)
                  const cellsForClue = clueCells(clue)
                  const first = cellsForClue.findIndex((k) => !isLocked(k))
                  setActiveIndex(first === -1 ? 0 : first)
                }}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                  activeClueId === clue.id ? 'bg-white/20' : 'bg-white/5'
                }`}
              >
                <span className="font-bold uppercase text-white/70">
                  {clue.direction === 'across' ? 'Across' : 'Down'}
                </span>{' '}
                {clue.clue}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center text-xs text-white/60">
          Tap any letter cell to read its clue, then type the answer. Tap it again
          where two words cross to switch between across and down.
        </p>
      )}

      {wrongFlash ? (
        <p className="text-center text-sm font-semibold text-amber-300">Not quite. Try again.</p>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-red-950/70 px-4 py-3 text-sm text-red-100" role="alert">
          {error}
        </p>
      ) : null}

      {/* Last in the flow so the sticky keyboard never covers the feedback above it. */}
      <VirtualKeyboard
        alphabet={config.puzzle_keyboard_alphabet ?? 'latin'}
        onKey={handleKey}
        onBackspace={handleBackspace}
        disabled={checking}
      />
    </div>
  )
}
