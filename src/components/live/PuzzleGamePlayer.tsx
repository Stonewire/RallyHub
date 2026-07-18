import { Check, Loader2, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { CrosswordPlayer } from '@/components/live/CrosswordPlayer'
import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { Button } from '@/components/ui/button'
import { RichText } from '@/components/ui/rich-text'
import {
  publishLiveBundleReload,
  publishPuzzleProgressChange,
  subscribeLiveBundleBroadcast,
} from '@/lib/live-broadcast'
import { gamePointsDisplay, textOnAccent } from '@/lib/live-event'
import { getCurrentParticipantSession } from '@/lib/participant-session'
import {
  liveMatchingItems,
  parsePuzzleProgress,
  puzzleType,
  seededPuzzleShuffle,
  type PuzzleProgress,
  type WordleCellState,
} from '@/lib/puzzle-engine'
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

function puzzleErrorMessage(reason: unknown): string {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    const message = String(reason.message)
    if (message && !message.toLowerCase().includes('failed to fetch')) return message
  }
  return 'Could not update the puzzle. Please try again.'
}

function feedbackColor(state: WordleCellState): string {
  if (state === 'correct') return '#16A34A'
  if (state === 'present') return '#D97706'
  return '#4B5563'
}

export function PuzzleGamePlayer({ eventId, teamId, game, accentColor }: Props) {
  const config = (game.config ?? {}) as GameConfig
  const type = puzzleType(config)
  const session = getCurrentParticipantSession()
  const teamToken =
    session?.eventId === eventId && session.teamId === teamId ? session.purchaseToken : undefined
  const [progress, setProgress] = useState<PuzzleProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guess, setGuess] = useState('')
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null)
  const [selectedRight, setSelectedRight] = useState<string | null>(null)
  const [wrongSelection, setWrongSelection] = useState<{ left: string; right: string } | null>(null)

  const loadProgress = useCallback(async () => {
    if (!teamToken) {
      setError('Rejoin this event on this phone once to enable secure puzzle play.')
      setLoading(false)
      return
    }
    const { data, error: loadError } = await supabase.rpc('get_team_puzzle_progress', {
      p_event_id: eventId,
      p_game_id: game.id,
      p_team_token: teamToken,
    })
    if (loadError) {
      setError(puzzleErrorMessage(loadError))
    } else {
      setProgress(parsePuzzleProgress(data as Json))
      setError(null)
    }
    setLoading(false)
  }, [eventId, game.id, teamToken])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadProgress updates after an awaited server response, not synchronously in the effect
    void loadProgress()
  }, [loadProgress])

  useEffect(
    () =>
      subscribeLiveBundleBroadcast(eventId, {
        onBundlePatch: (patch) => {
          if (
            patch.kind === 'puzzle_progress' &&
            patch.teamId === teamId &&
            patch.gameId === game.id
          ) {
            void loadProgress()
          }
        },
      }),
    [eventId, game.id, loadProgress, teamId],
  )

  async function submitWordleGuess() {
    if (!teamToken || saving) return
    setSaving(true)
    setError(null)
    try {
      const { data, error: submitError } = await supabase.rpc('submit_wordle_guess', {
        p_event_id: eventId,
        p_game_id: game.id,
        p_team_token: teamToken,
        p_guess: guess,
      })
      if (submitError) throw submitError
      const next = parsePuzzleProgress(data as Json)
      setProgress(next)
      setGuess('')
      void publishPuzzleProgressChange(eventId, teamId, game.id)
      if (next.completed) void publishLiveBundleReload(eventId)
    } catch (reason) {
      setError(puzzleErrorMessage(reason))
    } finally {
      setSaving(false)
    }
  }

  async function submitMatch(leftId: string, rightId: string) {
    if (!teamToken || saving) return
    setSaving(true)
    setError(null)
    try {
      const { data, error: submitError } = await supabase.rpc('submit_matching_pair', {
        p_event_id: eventId,
        p_game_id: game.id,
        p_team_token: teamToken,
        p_left_id: leftId,
        p_right_id: rightId,
      })
      if (submitError) throw submitError
      const next = parsePuzzleProgress(data as Json)
      if (next.lastMatchCorrect === false) {
        setWrongSelection({ left: leftId, right: rightId })
        window.setTimeout(() => setWrongSelection(null), 650)
      }
      setProgress(next)
      setSelectedLeft(null)
      setSelectedRight(null)
      void publishPuzzleProgressChange(eventId, teamId, game.id)
      if (next.completed) void publishLiveBundleReload(eventId)
    } catch (reason) {
      setError(puzzleErrorMessage(reason))
    } finally {
      setSaving(false)
    }
  }

  const items = liveMatchingItems(config)
  const leftItems = useMemo(
    () => seededPuzzleShuffle(items.left, `${eventId}:${teamId}:${game.id}:left`),
    [eventId, game.id, items.left, teamId],
  )
  const rightItems = useMemo(
    () => seededPuzzleShuffle(items.right, `${eventId}:${teamId}:${game.id}:right`),
    [eventId, game.id, items.right, teamId],
  )
  const matchedLeft = new Set(progress?.matchedLeftIds ?? [])
  const matchedRight = new Set(progress?.matchedRightIds ?? [])
  const wordLength = Math.max(3, Math.min(12, config.puzzle_wordle_length ?? 5))
  const onAccent = textOnAccent(accentColor)

  return (
    <div className="space-y-5 pb-5 text-center">
      <h2 className="xp-challenge-title xp-wrap-text mx-auto max-w-md line-clamp-3">
        {game.name}
      </h2>
      <span
        className="inline-flex rounded-full px-4 py-1.5 text-sm font-bold tracking-wide"
        style={{ backgroundColor: accentColor, color: onAccent }}
      >
        {gamePointsDisplay(game)} maximum
      </span>
      {game.cover_url ? (
        <img
          src={game.cover_url}
          alt=""
          className="mx-auto max-h-40 w-full rounded-xl object-cover object-center shadow-lg"
        />
      ) : null}
      {game.description ? (
        <RichText
          html={game.description}
          className="xp-challenge-description xp-wrap-text mx-auto max-w-md line-clamp-4"
        />
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-white/75">
          <Loader2 className="size-5 animate-spin" /> Loading puzzle…
        </div>
      ) : progress?.completed ? (
        <div className="xp-glass-panel rounded-2xl bg-black/30 p-8">
          <Check className="mx-auto size-12 text-green-400" />
          <p className="mt-3 text-2xl font-black">Puzzle complete!</p>
          <p className="mt-2 text-lg font-semibold" style={{ color: accentColor }}>
            +{progress.pointsAwarded ?? 0} points
          </p>
          <p className="mt-2 text-sm text-white/65">
            {type === 'wordle'
              ? `Solved in ${progress.attempts} ${progress.attempts === 1 ? 'guess' : 'guesses'}`
              : `${progress.wrongMatches} incorrect ${progress.wrongMatches === 1 ? 'match' : 'matches'}`}
          </p>
        </div>
      ) : type === 'wordle' ? (
        <div className="space-y-4">
          <div className="space-y-2" aria-label="Word guesses">
            {(progress?.guesses ?? []).map((row, rowIndex) => (
              <div key={`${row.word}-${rowIndex}`} className="flex justify-center gap-1.5">
                {Array.from(row.word.toLocaleUpperCase()).map((letter, index) => (
                  <span
                    key={`${index}-${letter}`}
                    className="flex size-11 items-center justify-center rounded-md text-lg font-black text-white shadow-sm"
                    style={{ backgroundColor: feedbackColor(row.feedback[index] ?? 'absent') }}
                  >
                    {letter}
                  </span>
                ))}
              </div>
            ))}
            <div className="flex justify-center gap-1.5">
              {Array.from({ length: wordLength }, (_, index) => (
                <span
                  key={index}
                  className="flex size-11 items-center justify-center rounded-md border-2 border-white/30 bg-black/20 text-lg font-black uppercase"
                >
                  {Array.from(guess)[index] ?? ''}
                </span>
              ))}
            </div>
          </div>
          <input
            value={guess}
            disabled={saving}
            maxLength={wordLength}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="xp-field w-full rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-center text-lg font-bold uppercase tracking-[0.18em] text-white placeholder:text-white/45"
            placeholder={`${wordLength}-letter word`}
            onChange={(event) =>
              setGuess(
                event.target.value
                  .replace(/[^\p{L}]/gu, '')
                  .slice(0, wordLength)
                  .toLocaleUpperCase(),
              )
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter' && Array.from(guess).length === wordLength) {
                void submitWordleGuess()
              }
            }}
          />
          <LiveAccentButton
            type="button"
            className="w-full py-4 text-base"
            accentColor={accentColor}
            disabled={saving || Array.from(guess).length !== wordLength}
            onClick={() => void submitWordleGuess()}
          >
            {saving ? 'Checking…' : 'Submit guess'}
          </LiveAccentButton>
          <p className="text-xs text-white/60">
            Unlimited guesses · each extra guess reduces the remaining score by 10%
          </p>
        </div>
      ) : type === 'matching' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              {leftItems.map((item) => {
                const matched = matchedLeft.has(item.id)
                const wrong = wrongSelection?.left === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={saving || matched}
                    className={`min-h-14 w-full rounded-xl border px-3 py-2 text-sm font-bold transition-all ${
                      matched
                        ? 'border-green-400/70 bg-green-600/65 text-white'
                        : wrong
                          ? 'border-red-300 bg-red-600 text-white'
                          : selectedLeft === item.id
                            ? 'border-white bg-white text-black'
                            : 'border-white/25 bg-white/10 text-white'
                    }`}
                    onClick={() => {
                      setSelectedLeft(item.id)
                      if (selectedRight) void submitMatch(item.id, selectedRight)
                    }}
                  >
                    {matched ? <Check className="mr-1 inline size-4" /> : null}
                    {item.text}
                  </button>
                )
              })}
            </div>
            <div className="space-y-2">
              {rightItems.map((item) => {
                const matched = matchedRight.has(item.id)
                const wrong = wrongSelection?.right === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={saving || matched}
                    className={`min-h-14 w-full rounded-xl border px-3 py-2 text-sm font-bold transition-all ${
                      matched
                        ? 'border-green-400/70 bg-green-600/65 text-white'
                        : wrong
                          ? 'border-red-300 bg-red-600 text-white'
                          : selectedRight === item.id
                            ? 'border-white bg-white text-black'
                            : 'border-white/25 bg-white/10 text-white'
                    }`}
                    onClick={() => {
                      setSelectedRight(item.id)
                      if (selectedLeft) void submitMatch(selectedLeft, item.id)
                    }}
                  >
                    {matched ? <Check className="mr-1 inline size-4" /> : null}
                    {item.text}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 text-xs text-white/65">
            <span>{matchedLeft.size}/{leftItems.length} matched</span>
            <span>·</span>
            <span>{progress?.wrongMatches ?? 0} mistakes</span>
          </div>
          {(selectedLeft || selectedRight) && !saving ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-white/70"
              onClick={() => {
                setSelectedLeft(null)
                setSelectedRight(null)
              }}
            >
              <RotateCcw className="mr-1 size-3.5" /> Clear selection
            </Button>
          ) : null}
        </div>
      ) : (
        <CrosswordPlayer eventId={eventId} teamId={teamId} game={game} accentColor={accentColor} />
      )}

      {error ? (
        <p className="rounded-xl bg-red-950/70 px-4 py-3 text-sm text-red-100" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
