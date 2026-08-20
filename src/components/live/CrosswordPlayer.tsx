import { Check, Lightbulb, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { VirtualKeyboard } from '@/components/live/VirtualKeyboard'
import {
  publishLiveBundleReload,
  publishPuzzleProgressChange,
  subscribeLiveBundleBroadcast,
} from '@/lib/live-broadcast'
import { downloadOfflineAnswerKeys, getOfflineAnswerKeys } from '@/lib/offline/package'
import type { OutboxItem } from '@/lib/offline/outbox'
import {
  applyLocalCrosswordCheck,
  applyLocalCrosswordHint,
  crosswordWordsFromKey,
  freshLocalPuzzleProgress,
  hasLocalTakeover,
  loadLocalPuzzleProgress,
  puzzleOfflineErrorMessage,
  saveLocalPuzzleProgress,
} from '@/lib/offline/puzzle-local'
import type { CrosswordWord } from '@/lib/offline/scoring'
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
  /** Queue a locally-scored puzzle result for the offline outbox to drain.
   *  Local play only runs while the device is offline, this is provided, and
   *  the crossword's answer key was downloaded; otherwise the server flow
   *  runs. */
  onQueuePuzzleResult?: (item: OutboxItem) => void
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

export function CrosswordPlayer({ eventId, teamId, game, accentColor, onQueuePuzzleResult }: Props) {
  const { t } = useTranslation('live')
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
  // The downloaded answer key's word list; set once on mount. Its presence is
  // what makes this crossword playable (checked, hinted, scored) offline.
  const offlineWordsRef = useRef<CrosswordWord[] | null>(null)
  // True once the LOCAL driver has recorded play for this grid: play then
  // stays local through reconnects until completion.
  const localTakeoverRef = useRef(false)
  // Latest applied progress, for callbacks that must read it without keeping
  // the whole progress object in their dependency lists.
  const progressRef = useRef<PuzzleProgress | null>(null)

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
  // The clues meeting at the selected cell — one each way at a crossing.
  const cluesHere = (panelCell ? (cluesByCell.get(panelCell) ?? []) : []).filter(
    (clue) => !solvedWordIds.has(clue.id),
  )

  const applyProgress = useCallback(
    (next: PuzzleProgress) => {
      progressRef.current = next
      setProgress(next)
      setCells((current) =>
        next.completed
          ? next.filledCells
          : { ...next.filledCells, ...current, ...next.revealedCells },
      )
      // With the key on device, IndexedDB mirrors every applied progress so
      // going offline mid-puzzle resumes the same board and timer origin.
      if (offlineWordsRef.current) saveLocalPuzzleProgress(eventId, teamId, game.id, next)
    },
    [eventId, game.id, teamId],
  )

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
      let words = crosswordWordsFromKey((await getOfflineAnswerKeys(eventId))?.[game.id])
      if (cancelled) return
      // Join-time download is fire-and-forget and can fail silently. Opening
      // the crossword online without its pack is the moment to self-heal, so
      // the next offline window has it.
      if (!words && navigator.onLine) {
        const fresh = await downloadOfflineAnswerKeys(eventId, new Date().toISOString())
        if (cancelled) return
        words = crosswordWordsFromKey(fresh?.[game.id])
      }
      offlineWordsRef.current = words
      // Local play runs when offline with the key on device, and STAYS local
      // once the local driver recorded play (a reconnect mid-grid must not
      // hand a behind server row the rest of the solve). Keys absent, the
      // server path below runs exactly as before.
      const takeover = onQueuePuzzleResult
        ? await hasLocalTakeover(eventId, teamId, game.id)
        : false
      if (cancelled) return
      localTakeoverRef.current = takeover
      if ((!navigator.onLine || takeover) && words && onQueuePuzzleResult) {
        const local = await loadLocalPuzzleProgress(eventId, teamId, game.id)
        if (cancelled) return
        applyProgress(local ?? freshLocalPuzzleProgress('crossword'))
        setError(null)
        setLoading(false)
        return
      }
      if (!navigator.onLine) {
        // No pack on the device and no connection: the server call below can
        // only die at the fetch layer. Say what is actually wrong instead.
        setError(t('puzzle.offlineNotDownloaded'))
        setLoading(false)
        return
      }
      const { data: existing, error: readError } = await supabase.rpc(
        'get_team_puzzle_progress',
        args,
      )
      if (cancelled) return
      if (readError) {
        setError(puzzleOfflineErrorMessage(readError, t('puzzle.crosswordLoadError')))
        setLoading(false)
        return
      }
      const parsed = parsePuzzleProgress(existing as Json)
      // A crossword finished offline stays finished while its queued result
      // drains: an empty (or older) server row must not reopen the board for a
      // second play. A server completed row still wins outright.
      const local =
        words && !parsed.completed ? await loadLocalPuzzleProgress(eventId, teamId, game.id) : null
      if (cancelled) return
      if (local?.completed) {
        applyProgress(local)
        setError(null)
        setLoading(false)
        return
      }
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
      if (startError) setError(puzzleOfflineErrorMessage(startError, t('puzzle.crosswordLoadError')))
      else {
        applyProgress(parsePuzzleProgress(data as Json))
        setError(null)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [applyProgress, eventId, game.id, onQueuePuzzleResult, t, teamId, teamToken])

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
                if (!data) return
                const next = parsePuzzleProgress(data as Json)
                // A locally completed board only yields to a completed server
                // row (the server never un-completes a puzzle).
                if (progressRef.current?.completed && !next.completed) return
                applyProgress(next)
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
    // Twice: the cover above is still loading on the first pass and shifts
    // everything down when it lands.
    const ids = [120, 700].map((delay) =>
      window.setTimeout(() => boardRef.current?.scrollIntoView({ block: 'start' }), delay),
    )
    return () => ids.forEach((id) => window.clearTimeout(id))
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
      // Offline (or after a local takeover) the debounced write lands in
      // IndexedDB instead of the fill RPC, so typed letters survive a reload.
      if ((!navigator.onLine || localTakeoverRef.current) && offlineWordsRef.current) {
        syncTimer.current = window.setTimeout(() => {
          const current = progressRef.current
          if (current && !current.completed) {
            localTakeoverRef.current = true
            saveLocalPuzzleProgress(
              eventId,
              teamId,
              game.id,
              { ...current, filledCells: nextCells },
              { takeover: true },
            )
          }
        }, 700)
        return
      }
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
      // Offline (or after a local takeover) with the key on device: validate
      // against the local word list and, on a full solve, queue ONE result for
      // the server to replay and re-score when the outbox drains.
      const words =
        !navigator.onLine || localTakeoverRef.current ? offlineWordsRef.current : null
      if (words && onQueuePuzzleResult) {
        const current = progressRef.current ?? freshLocalPuzzleProgress('crossword')
        const next = applyLocalCrosswordCheck(current, words, nextCells, maxPoints)
        localTakeoverRef.current = true
        applyProgress(next)
        saveLocalPuzzleProgress(eventId, teamId, game.id, next, { takeover: true })
        if (next.completed && !current.completed) {
          onQueuePuzzleResult({
            clientId: crypto.randomUUID(),
            eventId,
            teamId,
            kind: 'puzzle-result',
            gameId: game.id,
            createdAt: new Date().toISOString(),
            payload: {
              puzzleType: 'crossword',
              result: {
                cells: next.filledCells,
                solveSeconds: next.solveSeconds ?? 0,
                hintsUsed: next.hintsUsed,
              },
            },
          })
        } else if (!next.completed && !next.solvedWordIds.includes(wordId)) {
          setWrongFlash(true)
          window.setTimeout(() => setWrongFlash(false), 900)
        }
        return
      }
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
        setError(puzzleOfflineErrorMessage(reason, t('puzzle.crosswordError')))
      } finally {
        setChecking(false)
      }
    },
    [applyProgress, checking, eventId, game.id, maxPoints, onQueuePuzzleResult, t, teamId, teamToken],
  )

  const useHint = useCallback(async () => {
    if (!teamToken) return
    // Offline (or after a local takeover): reveal from the local word list
    // with the live server algorithm (exactly one letter, crossing preferred).
    const words = !navigator.onLine || localTakeoverRef.current ? offlineWordsRef.current : null
    if (words && onQueuePuzzleResult) {
      const current = progressRef.current ?? freshLocalPuzzleProgress('crossword')
      const next = applyLocalCrosswordHint(current, words, cells)
      localTakeoverRef.current = true
      applyProgress(next)
      saveLocalPuzzleProgress(eventId, teamId, game.id, next, { takeover: true })
      return
    }
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
      setError(puzzleOfflineErrorMessage(reason, t('puzzle.hintError')))
    }
  }, [applyProgress, cells, eventId, game.id, onQueuePuzzleResult, t, teamId, teamToken])

  function isLocked(key: string) {
    return solvedCellKeys.has(key) || revealedKeys.has(key)
  }

  function handleKey(letter: string) {
    if (checking || !activeClue) return
    // Shared keyboard: anything that is not a letter has no meaning in a grid.
    if (!/^\p{L}$/u.test(letter)) return
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

  /** Jump the cursor to a word, from the clue list or a direction button. */
  function selectClue(clue: CrosswordClue) {
    setActiveClueId(clue.id)
    const cellsForClue = clueCells(clue)
    const first = cellsForClue.findIndex((k) => !isLocked(k))
    setActiveIndex(first === -1 ? 0 : first)
    setPanelCell(cellsForClue[first === -1 ? 0 : first])
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
    return <p className="py-8 text-white/70">{t('puzzle.crosswordNotConfigured')}</p>
  }

  if (tokenMissing) {
    return (
      <p className="rounded-xl bg-red-950/70 px-4 py-3 text-sm text-red-100" role="alert">
        {t('puzzle.tokenMissing')}
      </p>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-white/75">
        <Loader2 className="size-5 animate-spin" /> {t('puzzle.crosswordLoading')}
      </div>
    )
  }

  if (progress?.completed) {
    return (
      <div className="xp-glass-panel rounded-2xl bg-black/30 p-8 text-center">
        <Check className="mx-auto size-12 text-green-400" />
        <p className="mt-3 text-2xl font-black">{t('puzzle.crosswordComplete')}</p>
        <p className="mt-2 text-lg font-semibold" style={{ color: accentColor }}>
          {t('puzzle.pointsAwarded', { points: progress.pointsAwarded ?? 0 })}
        </p>
        {progress.solveSeconds !== null ? (
          <p className="mt-2 text-sm text-white/65">
            {t('puzzle.solvedIn', { time: formatClock(progress.solveSeconds) })}
          </p>
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
    <div ref={boardRef} className="scroll-mt-3 space-y-4 pb-60 md:pb-[20rem]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-lg font-black tabular-nums md:text-2xl ${clockColor}`}>{formatClock(remaining)}</p>
          <p className="text-[10px] text-white/60 md:text-xs">{t('puzzle.timeLeft')}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black tabular-nums md:text-2xl" style={{ color: accentColor }}>
            {livePoints}
          </p>
          <p className="text-[10px] text-white/60 md:text-xs">{t('puzzle.pointsIfSolvedNow')}</p>
        </div>
        <button
          type="button"
          onClick={useHint}
          disabled={hintsUsed >= 3}
          className="flex flex-col items-center rounded-xl border border-white/25 bg-white/10 px-2.5 py-1.5 text-white disabled:opacity-40 md:px-3 md:py-2"
        >
          <Lightbulb className="size-4 md:size-5" />
          <span className="mt-0.5 text-[10px] font-semibold md:text-xs">
            {t('puzzle.hint', { remaining: 3 - hintsUsed })}
          </span>
        </button>
      </div>

      {/* Clues beside the board on a tablet, where there is width for both, so
          nothing has to be scrolled away to read a clue. On a phone the board
          keeps the width and only the selected cell's two clues sit under it. */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        <div className="order-2 min-w-0 flex-1 md:order-1">
          {/* Bounded and scrollable: a long crossword should not stretch the
              page past the board it belongs to. */}
          <div className="hidden max-h-[26rem] overflow-y-auto pr-1 md:block">
            {(['across', 'down'] as const).map((direction) => (
              <div key={direction} className="mb-4">
                <p className="mb-1.5 text-xs font-black tracking-[0.16em] uppercase opacity-70">
                  {direction === 'across' ? t('puzzle.across') : t('puzzle.down')}
                </p>
                <ul className="space-y-1">
                  {clues
                    .filter((clue) => clue.direction === direction)
                    .map((clue) => {
                      const solved = solvedWordIds.has(clue.id)
                      const active = activeClueId === clue.id
                      // Both clues through the selected cell are marked, so it
                      // is clear which pair the choice is between.
                      const atCursor = cluesHere.some((c) => c.id === clue.id)
                      return (
                        <li key={clue.id}>
                          <button
                            type="button"
                            onClick={() => selectClue(clue)}
                            className={`w-full rounded-md px-2 py-1 text-left text-sm leading-snug ${
                              solved
                                ? 'text-green-300/80 line-through'
                                : active
                                  ? 'bg-white/20 font-bold text-white'
                                  : atCursor
                                    ? 'bg-white/10 text-white'
                                    : 'text-white/75'
                            }`}
                          >
                            <span className="mr-1.5 font-black tabular-nums">{clue.number}.</span>
                            {clue.clue}
                          </button>
                        </li>
                      )
                    })}
                </ul>
              </div>
            ))}
          </div>

          {cluesHere.length > 0 ? (
            <div className="space-y-1.5 md:hidden">
              {cluesHere.map((clue) => (
                <button
                  key={clue.id}
                  type="button"
                  onClick={() => selectClue(clue)}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm leading-snug ${
                    activeClueId === clue.id ? 'bg-white/20 font-bold' : 'bg-white/5 text-white/75'
                  }`}
                >
                  <span className="font-black tabular-nums">
                    {clue.number} {clue.direction === 'across' ? t('puzzle.across') : t('puzzle.down')}
                  </span>{' '}
                  {clue.clue}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-white/60 md:hidden">
              {t('puzzle.crosswordTapTip')}
            </p>
          )}
        </div>

        <div className="order-1 md:order-2 md:shrink-0">
      <div
        className={`mx-auto grid w-fit grid-cols-6 gap-1 transition-transform ${
          wrongFlash ? 'animate-pulse' : ''
        }`}
      >
        {Array.from({ length: GRID_SIZE }, (_, row) =>
          Array.from({ length: GRID_SIZE }, (_, col) => {
            const key = `${row}-${col}`
            if (blockedKeys.has(key)) {
              return <span key={key} className="size-10 rounded-md bg-[#FFC107] md:size-14" />
            }
            if (!openKeys.has(key)) {
              return <span key={key} className="size-10 rounded-md bg-black/50 md:size-14" />
            }
            const number = startNumbers.get(key)
            const solved = solvedCellKeys.has(key)
            const revealed = revealedKeys.has(key)
            const locked = solved || revealed
            const inActive = activeCells.includes(key)
            const isCursor = inActive && !locked && activeCells[activeIndex] === key
            const askDirection = panelCell === key && cluesHere.length > 1
            return (
              <span key={key} className="relative">
                {number ? (
                  <span className="absolute top-0 left-0.5 z-10 text-[8px] font-bold text-white/70 md:top-0.5 md:left-1 md:text-[10px]">
                    {number}
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={checking}
                  onClick={() => selectCell(key)}
                  aria-label={t('puzzle.cellPosition', { row: row + 1, col: col + 1 })}
                  className={`size-10 rounded-md border-2 text-center text-base font-black uppercase md:size-14 md:text-lg ${
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
                {/* Asked where it was tapped, so the choice is next to the
                    cell it applies to rather than somewhere off the board. */}
                {askDirection ? (
                  <span className="absolute top-full left-1/2 z-30 mt-1 flex -translate-x-1/2 gap-1">
                    {cluesHere.map((clue) => (
                      <button
                        key={clue.id}
                        type="button"
                        onClick={() => selectClue(clue)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black whitespace-nowrap uppercase shadow-lg md:text-xs ${
                          activeClueId === clue.id ? 'text-black' : 'bg-black/80 text-white'
                        }`}
                        style={
                          activeClueId === clue.id ? { backgroundColor: accentColor } : undefined
                        }
                      >
                        {clue.direction === 'across' ? t('puzzle.across') : t('puzzle.down')}
                      </button>
                    ))}
                  </span>
                ) : null}
              </span>
            )
          }),
        )}
      </div>
        </div>
      </div>

      {wrongFlash ? (
        <p className="text-center text-sm font-semibold text-amber-300">{t('puzzle.notQuite')}</p>
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
