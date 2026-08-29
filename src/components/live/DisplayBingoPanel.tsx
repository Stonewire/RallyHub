import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import { useBingoRun } from '@/hooks/use-bingo-run'
import { useAudioLevels } from '@/hooks/use-audio-levels'
import { bingoTrackPlaybackUrl, musicTracksFromGameConfig } from '@/lib/bingo-playback'
import {
  bingoTeamGuessStates,
  bingoVisualizerBars,
  markMapsEqual,
  pendingBingoMarkIdsByTeam,
  teamInitials,
} from '@/lib/bingo-display'
import { STANDBY_ACCENT, textOnAccent } from '@/lib/live-event'
import type { Tables } from '@/types/helpers'

const BAR_COUNT = 40

type DisplayBingoPanelProps = {
  eventId: string
  stageIndex: number
  gameId: string | null
  gameName: string | null
  state: Tables<'event_state'>
  /** Named teams only, already sorted by slot number. */
  teams: Tables<'teams'>[]
  submissions: Tables<'submissions'>[]
  /** Event brand accent, used to tint the visualizer bars. */
  accent: string
  /** The bingo game row, for resolving this round's clip (R2.4). */
  game?: Tables<'games'> | null
  textClass: string
}

/**
 * The big-screen bingo view (P2.5): an audio visualizer in the centre while a
 * song plays, no song metadata anywhere, and the teams as a compact row of
 * circles along the bottom that double as guess indicators for the current
 * round. Read-only: it derives everything from the bundle and the bingo run
 * the display already receives.
 */
export function DisplayBingoPanel({
  eventId,
  stageIndex,
  gameId,
  gameName,
  state,
  teams,
  submissions,
  accent,
  game = null,
  textClass,
}: DisplayBingoPanelProps) {
  const { t } = useTranslation('live')
  const runQuery = useBingoRun(eventId, stageIndex)
  const run = runQuery.data ?? null
  const roundKey = run ? `${run.id}:${run.current_play_index}` : 'none'
  const currentTrackId = run?.playOrder[run.current_play_index] ?? null
  const playing = state.bingo_state === 'playing'
  const revealed = state.bingo_state === 'revealed'
  // R2.4: the bars follow the actual song. Null whenever live analysis is not
  // available (no clip, not playing, or the browser refused), and the seeded
  // animation below carries the round instead.
  const clipUrl = useMemo(() => {
    if (!game || !currentTrackId) return null
    const track = musicTracksFromGameConfig(game.config).find((t) => t.id === currentTrackId)
    return track ? bingoTrackPlaybackUrl(track) : null
  }, [game, currentTrackId])
  const levels = useAudioLevels(clipUrl, playing, BAR_COUNT)

  // Remember which submission row carries each team's pending mark while the
  // round is open. Scoring reuses those exact rows (pending flips to approved
  // or rejected), so at the reveal each remembered row's new status says
  // whether the team guessed right. Resets when the run advances to the next
  // song. A display that loads fresh mid-reveal has nothing remembered and
  // simply shows neutral circles until the next round, which is fine.
  const [roundMarks, setRoundMarks] = useState<{
    key: string
    byTeam: ReadonlyMap<string, string>
  }>({ key: roundKey, byTeam: new Map() })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- remembers the last open-round mark snapshot across the flip to 'revealed'; the markMapsEqual guard makes it settle after at most one extra render per actual mark change
    setRoundMarks((prev) => {
      const reset = prev.key !== roundKey
      if (!playing || !gameId) {
        return reset ? { key: roundKey, byTeam: new Map() } : prev
      }
      const next = pendingBingoMarkIdsByTeam(submissions, gameId)
      if (!reset && markMapsEqual(prev.byTeam, next)) return prev
      return { key: roundKey, byTeam: next }
    })
  }, [roundKey, playing, submissions, gameId])

  const guessStates = bingoTeamGuessStates({
    bingoState: state.bingo_state,
    teamIds: teams.map((team) => team.id),
    submissions,
    gameId,
    rememberedMarkIdByTeam: roundMarks.byTeam,
  })

  // Seeded per song so every round gets its own waveform shape.
  const bars = useMemo(
    () => bingoVisualizerBars(currentTrackId ?? `idle:${eventId}`, BAR_COUNT),
    [currentTrackId, eventId],
  )

  const compact = teams.length > 14
  const circleClass = compact ? 'size-10 text-[11px]' : 'size-14 text-base'

  return (
    <div className={`flex h-full w-full flex-col ${textClass}`}>
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-8">
        {!playing && !revealed ? (
          <div className="text-center">
            <p className="font-sans text-2xl font-bold opacity-80 md:text-3xl">
              {t('display.getReadyFor')}
            </p>
            <p className="font-sans mt-2 text-4xl font-bold md:text-5xl">
              {gameName ?? t('join.bingo.fallbackName')}
            </p>
          </div>
        ) : null}
        {/* The bars follow the song the room is hearing: the display loads the
            same clip and analyses it silently (see useAudioLevels, which never
            connects the analyser to the speakers). When live analysis is not
            available the seeded CSS animation carries the round instead, so
            the screen never goes still. No song title, artist or any metadata
            is ever shown here. */}
        <div
          aria-hidden
          className={`flex h-[34svh] max-h-[380px] w-full max-w-4xl items-center justify-center gap-[0.45%] transition-opacity duration-500 ${
            playing ? 'opacity-100' : 'opacity-40'
          }`}
        >
          {bars.map((bar, i) => {
            const level = levels?.[i]
            // Live level drives the height directly; the seeded animation is
            // switched off for that bar so the two never fight.
            const style = (
              level === undefined
                ? {
                    background: `linear-gradient(180deg, rgba(255,255,255,0.75), ${accent})`,
                    animationDuration: `${bar.durationMs}ms`,
                    animationDelay: `-${bar.delayMs}ms`,
                    animationPlayState: playing ? 'running' : 'paused',
                    '--eq-min': String(bar.min),
                    '--eq-max': String(bar.max),
                  }
                : {
                    background: `linear-gradient(180deg, rgba(255,255,255,0.75), ${accent})`,
                    animation: 'none',
                    transform: `scaleY(${Math.max(0.06, Math.min(1, level))})`,
                    transition: 'transform 90ms linear',
                  }
            ) as CSSProperties
            return (
              <div
                key={i}
                className="rh-eq-bar h-full min-w-0 flex-1 origin-bottom rounded-full"
                style={style}
              />
            )
          })}
        </div>
      </div>
      {/* Team circles: neutral while guessing is open, team colour the moment
          the team marks a cell, green or red at the reveal. */}
      <div className="mx-auto flex w-full max-w-5xl shrink-0 flex-wrap items-center justify-center gap-2 px-4 pt-6 pb-1">
        {teams.map((team) => {
          const guess = guessStates.get(team.id) ?? 'neutral'
          const teamColor = team.color ?? STANDBY_ACCENT
          let style: CSSProperties
          let extra = ''
          if (guess === 'marked') {
            style = {
              backgroundColor: teamColor,
              color: textOnAccent(teamColor),
              boxShadow: `0 0 18px ${teamColor}`,
            }
            extra = ' scale-110'
          } else if (guess === 'correct') {
            style = {
              backgroundColor: '#16a34a',
              color: '#ffffff',
              boxShadow: '0 0 18px rgba(22,163,74,0.8)',
            }
            extra = ' scale-110'
          } else if (guess === 'wrong') {
            style = { backgroundColor: '#dc2626', color: '#ffffff' }
          } else {
            style = {
              backgroundColor: 'rgba(60,60,60,0.45)',
              color: 'rgba(255,255,255,0.8)',
            }
          }
          return (
            <div
              key={team.id}
              className={`${circleClass} flex items-center justify-center rounded-full font-sans font-black tracking-wide uppercase transition-all duration-300${extra}`}
              style={style}
              title={team.name ?? undefined}
            >
              {teamInitials(team.name ?? '')}
            </div>
          )
        })}
      </div>
      <style>{`
        @keyframes rh-bingo-eq {
          0% { transform: scaleY(var(--eq-min, 0.15)); }
          100% { transform: scaleY(var(--eq-max, 1)); }
        }
        .rh-eq-bar {
          transform: scaleY(var(--eq-min, 0.15));
          transform-origin: center;
          animation-name: rh-bingo-eq;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          animation-direction: alternate;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .rh-eq-bar { animation: none; }
        }
      `}</style>
    </div>
  )
}
