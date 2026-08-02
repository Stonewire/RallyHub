import { useMemo } from 'react'

import { readableTextOn } from '@/lib/hex-color'
import type { Tables } from '@/types/helpers'

type LeaderboardProps = {
  teams: Tables<'teams'>[]
  showScores: boolean
  layout: 'rank_list' | 'orbit_view'
  textClass?: string
}

function orbitGrid(teamCount: number) {
  if (teamCount <= 2) return { cols: 2, maxPx: 200 }
  if (teamCount <= 4) return { cols: 2, maxPx: 180 }
  if (teamCount <= 6) return { cols: 3, maxPx: 150 }
  if (teamCount <= 9) return { cols: 3, maxPx: 130 }
  if (teamCount <= 12) return { cols: 4, maxPx: 115 }
  if (teamCount <= 16) return { cols: 4, maxPx: 100 }
  return { cols: 5, maxPx: 88 }
}

/**
 * Text on the display sits over a photo or an animated gradient that changes
 * per event, so plain text can land on anything. Every label is a badge: a
 * dark chip under white text, a light chip under black, chosen from the
 * event's own display_text_color.
 */
function badgeClass(textClass: string): string {
  return textClass === 'text-black'
    ? 'bg-white/75 text-black shadow-[0_2px_10px_rgba(0,0,0,0.18)] backdrop-blur-sm'
    : 'bg-black/45 text-white shadow-[0_2px_10px_rgba(0,0,0,0.35)] backdrop-blur-sm'
}

/** Float keyframes, declared once per leaderboard render. */
function FloatStyles() {
  return (
    <style>{`
      @keyframes xp-team-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      .xp-team-float { animation: xp-team-float 7s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .xp-team-float { animation: none; }
      }
    `}</style>
  )
}

export function Leaderboard({
  teams,
  showScores,
  layout,
  textClass = 'text-white',
}: LeaderboardProps) {
  const ranked = [...teams]
    .filter((t) => t.name?.trim())
    .sort((a, b) => b.score - a.score)

  const orbit = useMemo(() => orbitGrid(ranked.length), [ranked.length])
  const badge = badgeClass(textClass)

  if (ranked.length === 0) {
    return (
      <p className={`py-12 text-center text-sm opacity-60 ${textClass}`}>
        No teams have joined yet.
      </p>
    )
  }

  if (layout === 'orbit_view') {
    const maxScore = Math.max(1, ...ranked.map((t) => t.score))
    const rows = Math.ceil(ranked.length / orbit.cols)
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center px-8 py-4">
        <FloatStyles />
        {/* Rows share the available height rather than taking a fixed pixel
            size: with a logo, title and timer above, fixed tiles overflowed
            and the rank badges were clipped off the top of the screen. */}
        <div
          className="grid h-full max-h-full w-full max-w-6xl place-items-center justify-items-center gap-x-8 gap-y-4"
          style={{
            gridTemplateColumns: `repeat(${orbit.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          }}
        >
          {ranked.map((team, i) => {
            const scoreRatio = team.score / maxScore
            // Relative size still carries standing, but as a share of the row
            // height so it scales with the screen. When scores are hidden the
            // bubbles are uniform, or the size would leak the ranking.
            const heightPct = showScores ? 72 + scoreRatio * 28 : 86
            const color = team.color ?? '#888'
            return (
              <div
                key={team.id}
                className={`xp-team-float flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 ${textClass}`}
                style={{
                  // Wider than the tile on purpose: a team name needs more room
                  // than its photo, and truncating names was the first thing
                  // that failed at across-the-room distance.
                  maxWidth: Math.round(orbit.maxPx * 1.6),
                  // Staggered so the group drifts rather than pulsing in unison.
                  animationDelay: `${(i % 5) * 0.6}s`,
                  animationDuration: `${6.5 + (i % 3) * 0.8}s`,
                }}
              >
                <div
                  className="relative aspect-square min-h-0 shrink"
                  style={{ height: `${heightPct}%`, maxWidth: '100%' }}
                >
                  <div
                    className="xp-team-tile relative flex size-full items-center justify-center rounded-full"
                    style={{
                      // Ring in the team colour, the same colour bloomed
                      // outwards as a glow, then a soft drop shadow for depth.
                      boxShadow: `0 0 0 4px ${color}, 0 0 28px 6px ${color}66, 0 14px 30px rgba(0,0,0,0.35)`,
                    }}
                  >
                    {team.photo_url ? (
                      <img
                        src={team.photo_url}
                        alt=""
                        className="size-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="size-full rounded-full" style={{ background: color }} />
                    )}
                  </div>
                  {showScores ? (
                    // Rank sits on the tile rather than under the name, so
                    // position reads first at across-the-room distance.
                    <span
                      className="absolute -top-2 -left-2 flex size-9 items-center justify-center rounded-full text-base font-black tabular-nums shadow-[0_2px_10px_rgba(0,0,0,0.4)]"
                      style={{ background: color, color: readableTextOn(color) }}
                    >
                      {i + 1}
                    </span>
                  ) : null}
                </div>

                <span
                  className={`max-w-full shrink-0 rounded-full px-3.5 py-1 text-center text-lg leading-tight font-bold break-words ${badge}`}
                >
                  {team.name}
                </span>
                {showScores ? (
                  <span
                    className={`shrink-0 rounded-full px-3 py-0.5 text-xl font-black tabular-nums ${badge}`}
                  >
                    {team.score}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const maxScore = Math.max(1, ...ranked.map((t) => t.score))

  return (
    <ul className={`mx-auto w-full max-w-3xl space-y-3 px-4 py-6 ${textClass}`}>
      {ranked.map((team, i) => (
        <li
          key={team.id}
          className="xp-leaderboard-row flex items-center gap-4 bg-black/35 px-4 py-3 shadow-[0_6px_20px_rgba(0,0,0,0.28)] backdrop-blur-sm"
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-base font-black tabular-nums"
            style={{
              background: team.color ?? '#888',
              color: readableTextOn(team.color ?? '#888'),
            }}
          >
            {i + 1}
          </span>
          {team.photo_url ? (
            <img
              src={team.photo_url}
              alt=""
              width={48}
              height={48}
              className="size-12 rounded-full object-cover"
              style={{ boxShadow: `0 0 0 3px ${team.color ?? '#888'}` }}
            />
          ) : (
            <div
              className="size-12 rounded-full"
              style={{ background: team.color ?? '#666' }}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold">{team.name}</p>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(team.score / maxScore) * 100}%`,
                  background: team.color ?? '#FFC107',
                }}
              />
            </div>
          </div>
          {showScores ? (
            <span className="text-2xl font-black tabular-nums">{team.score}</span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
