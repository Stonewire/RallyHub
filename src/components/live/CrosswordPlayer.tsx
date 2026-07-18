import { Check, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  publishLiveBundleReload,
  publishPuzzleProgressChange,
  subscribeLiveBundleBroadcast,
} from '@/lib/live-broadcast'
import { getCurrentParticipantSession } from '@/lib/participant-session'
import { parsePuzzleProgress, type PuzzleProgress } from '@/lib/puzzle-engine'
import { supabase } from '@/lib/supabase'
import type { GameConfig } from '@/types/game-config'
import type { Json } from '@/types/json'
import type { Tables } from '@/types/helpers'

type Props = {
  eventId: string
  teamId: string
  game: Tables<'games'>
  accentColor: string
}

function formatSolveTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export function CrosswordPlayer({ eventId, teamId, game, accentColor }: Props) {
  const config = (game.config ?? {}) as GameConfig
  const layout = config.puzzle_crossword_layout
  const session = getCurrentParticipantSession()
  const teamToken =
    session?.eventId === eventId && session.teamId === teamId ? session.purchaseToken : undefined

  const [progress, setProgress] = useState<PuzzleProgress | null>(null)
  const [cells, setCells] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [wrongFlash, setWrongFlash] = useState(false)
  const syncTimer = useRef<number | null>(null)
  const cellRefs = useRef(new Map<string, HTMLInputElement>())

  const openCells = useMemo(() => layout?.cells ?? [], [layout])
  const openKeys = useMemo(() => openCells.map(({ row, col }) => `${row}-${col}`), [openCells])
  const across = useMemo(
    () => (layout?.clues ?? []).filter((clue) => clue.direction === 'across'),
    [layout],
  )
  const down = useMemo(
    () => (layout?.clues ?? []).filter((clue) => clue.direction === 'down'),
    [layout],
  )
  const startNumbers = useMemo(() => {
    const map = new Map<string, number>()
    for (const clue of layout?.clues ?? []) {
      if (!map.has(`${clue.row}-${clue.col}`)) map.set(`${clue.row}-${clue.col}`, clue.number)
    }
    return map
  }, [layout])

  const applyProgress = useCallback((next: PuzzleProgress) => {
    setProgress(next)
    setCells((current) => (next.completed ? next.filledCells : { ...next.filledCells, ...current }))
  }, [])

  const tokenMissing = !teamToken

  // Mounting registers the fill row, which starts the solve timer server-side.
  useEffect(() => {
    if (!teamToken) return
    let cancelled = false
    void supabase
      .rpc('update_crossword_fill', {
        p_event_id: eventId,
        p_game_id: game.id,
        p_team_token: teamToken,
        p_cells: {},
      })
      .then(({ data, error: loadError }) => {
        if (cancelled) return
        if (loadError) {
          setError(loadError.message)
        } else {
          applyProgress(parsePuzzleProgress(data as Json))
          setError(null)
        }
        setLoading(false)
      })
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

  const checkGrid = useCallback(
    async (nextCells: Record<string, string>) => {
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
        } else if (next.lastCheckCorrect === false) {
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

  function setCellLetter(key: string, raw: string) {
    const letter = raw.replace(/[^\p{L}]/gu, '').slice(-1).toLocaleUpperCase()
    const nextCells = { ...cells }
    if (letter) nextCells[key] = letter
    else delete nextCells[key]
    setCells(nextCells)
    setError(null)
    syncFill(nextCells)
    if (letter) {
      const index = openKeys.indexOf(key)
      const nextKey = openKeys[index + 1]
      if (nextKey) cellRefs.current.get(nextKey)?.focus()
    }
    if (openKeys.every((cellKey) => nextCells[cellKey])) {
      void checkGrid(nextCells)
    }
  }

  if (!layout || openCells.length === 0) {
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
      <div className="xp-glass-panel rounded-2xl bg-black/30 p-8">
        <Check className="mx-auto size-12 text-green-400" />
        <p className="mt-3 text-2xl font-black">Crossword complete!</p>
        <p className="mt-2 text-lg font-semibold" style={{ color: accentColor }}>
          +{progress.pointsAwarded ?? 0} points
        </p>
        {progress.solveSeconds !== null ? (
          <p className="mt-2 text-sm text-white/65">
            Solved in {formatSolveTime(progress.solveSeconds)}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        className={`mx-auto grid w-fit grid-cols-5 gap-1 transition-transform ${
          wrongFlash ? 'scale-[1.02]' : ''
        }`}
      >
        {Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 5 }, (_, col) => {
            const key = `${row}-${col}`
            const open = openKeys.includes(key)
            if (!open) {
              return <span key={key} className="size-12 rounded-md bg-black/50" />
            }
            const number = startNumbers.get(key)
            return (
              <span key={key} className="relative">
                {number ? (
                  <span className="absolute top-0.5 left-1 z-10 text-[9px] font-bold text-white/70">
                    {number}
                  </span>
                ) : null}
                <input
                  ref={(node) => {
                    if (node) cellRefs.current.set(key, node)
                    else cellRefs.current.delete(key)
                  }}
                  value={cells[key] ?? ''}
                  disabled={checking}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={`Row ${row + 1} column ${col + 1}`}
                  className={`size-12 rounded-md border-2 bg-white/10 text-center text-lg font-black uppercase text-white focus:border-white ${
                    wrongFlash ? 'border-amber-400/80' : 'border-white/30'
                  }`}
                  onChange={(event) => setCellLetter(key, event.target.value)}
                />
              </span>
            )
          }),
        )}
      </div>
      {wrongFlash ? (
        <p className="text-sm font-semibold text-amber-300">Not quite yet. Keep going!</p>
      ) : null}
      <div className="grid gap-4 text-left sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-white/60">Across</p>
          <ul className="mt-1 space-y-1 text-sm">
            {across.map((clue) => (
              <li key={clue.id}>
                <span className="font-bold">{clue.number}.</span> {clue.clue}{' '}
                <span className="text-white/50">({clue.length})</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-white/60">Down</p>
          <ul className="mt-1 space-y-1 text-sm">
            {down.map((clue) => (
              <li key={clue.id}>
                <span className="font-bold">{clue.number}.</span> {clue.clue}{' '}
                <span className="text-white/50">({clue.length})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-xs text-white/60">
        Solve fast for full points. The grid checks itself when every cell is filled.
      </p>
      {error ? (
        <p className="rounded-xl bg-red-950/70 px-4 py-3 text-sm text-red-100" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
