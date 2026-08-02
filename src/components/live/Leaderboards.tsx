import { useMemo } from 'react'

import { readableTextOn } from '@/lib/hex-color'
import type { Tables } from '@/types/helpers'

type LeaderboardProps = {
  teams: Tables<'teams'>[]
  showScores: boolean
  layout: 'rank_list' | 'orbit_view'
  textClass?: string
}

/**
 * Columns, label sizes and breathing room for the orbit grid, all stepping
 * down together with the head count.
 *
 * `tile` is the share of the row height the circle takes, which is what
 * reserves space for the labels underneath and the gap to the next row. It
 * shrinks as the grid fills up, because a dense grid needs proportionally
 * more of each cell for its text than a sparse one.
 */
function orbitLayout(teamCount: number) {
  if (teamCount <= 2)
    return { cols: 2, maxPx: 220, name: 'text-xl', score: 'text-2xl', rank: 40, gapX: 'gap-x-10', gapY: 'gap-y-8', tile: 66, span: 10 }
  if (teamCount <= 4)
    return { cols: 2, maxPx: 200, name: 'text-lg', score: 'text-xl', rank: 36, gapX: 'gap-x-10', gapY: 'gap-y-8', tile: 64, span: 10 }
  if (teamCount <= 6)
    return { cols: 3, maxPx: 170, name: 'text-lg', score: 'text-xl', rank: 34, gapX: 'gap-x-8', gapY: 'gap-y-7', tile: 62, span: 10 }
  if (teamCount <= 9)
    return { cols: 3, maxPx: 150, name: 'text-base', score: 'text-lg', rank: 30, gapX: 'gap-x-8', gapY: 'gap-y-7', tile: 60, span: 9 }
  if (teamCount <= 12)
    return { cols: 4, maxPx: 132, name: 'text-sm', score: 'text-base', rank: 26, gapX: 'gap-x-7', gapY: 'gap-y-6', tile: 58, span: 9 }
  if (teamCount <= 16)
    return { cols: 4, maxPx: 118, name: 'text-sm', score: 'text-base', rank: 24, gapX: 'gap-x-7', gapY: 'gap-y-6', tile: 56, span: 8 }
  if (teamCount <= 20)
    return { cols: 5, maxPx: 104, name: 'text-xs', score: 'text-sm', rank: 22, gapX: 'gap-x-6', gapY: 'gap-y-5', tile: 54, span: 8 }
  if (teamCount <= 25)
    return { cols: 5, maxPx: 94, name: 'text-xs', score: 'text-sm', rank: 20, gapX: 'gap-x-6', gapY: 'gap-y-5', tile: 52, span: 8 }
  if (teamCount <= 30)
    return { cols: 6, maxPx: 86, name: 'text-[11px]', score: 'text-xs', rank: 19, gapX: 'gap-x-5', gapY: 'gap-y-4', tile: 50, span: 7 }
  if (teamCount <= 36)
    return { cols: 6, maxPx: 78, name: 'text-[11px]', score: 'text-xs', rank: 18, gapX: 'gap-x-5', gapY: 'gap-y-4', tile: 48, span: 7 }
  if (teamCount <= 48)
    return { cols: 8, maxPx: 68, name: 'text-[10px]', score: 'text-[11px]', rank: 16, gapX: 'gap-x-4', gapY: 'gap-y-4', tile: 46, span: 6 }
  if (teamCount <= 64)
    return { cols: 9, maxPx: 60, name: 'text-[9px]', score: 'text-[10px]', rank: 14, gapX: 'gap-x-3', gapY: 'gap-y-3', tile: 44, span: 6 }
  return { cols: 10, maxPx: 52, name: 'text-[9px]', score: 'text-[9px]', rank: 13, gapX: 'gap-x-3', gapY: 'gap-y-3', tile: 42, span: 5 }
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
        50% { transform: translateY(-3px); }
      }
      .xp-team-float { animation: xp-team-float 9s ease-in-out infinite; }
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
  // Hiding scores has to hide the standing too. Sorted by score, the order
  // itself announces who is winning, so with scores off the teams sit in join
  // order (slot number) instead.
  const ranked = [...teams]
    .filter((t) => t.name?.trim())
    .sort((a, b) =>
      showScores ? b.score - a.score : (a.slot_number ?? 0) - (b.slot_number ?? 0),
    )

  const orbit = useMemo(() => orbitLayout(ranked.length), [ranked.length])
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
          className={`grid h-full max-h-full w-full max-w-7xl place-items-center justify-items-center ${orbit.gapX} ${orbit.gapY}`}
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
            const heightPct = showScores
              ? orbit.tile + scoreRatio * orbit.span
              : orbit.tile + orbit.span * 0.5
            const color = team.color ?? '#888'
            return (
              <div
                key={team.id}
                className={`xp-team-float flex h-full min-h-0 w-full flex-col items-center justify-center gap-1.5 ${textClass}`}
                style={{
                  // Wider than the tile on purpose: a team name needs more room
                  // than its photo, and truncating names was the first thing
                  // that failed at across-the-room distance.
                  maxWidth: Math.round(orbit.maxPx * 1.6),
                  // Staggered so the group drifts rather than pulsing in unison.
                  animationDelay: `${(i % 5) * 0.6}s`,
                  animationDuration: `${8.5 + (i % 3) * 1.2}s`,
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
                      className="absolute -top-1.5 -left-1.5 flex items-center justify-center rounded-full font-black tabular-nums shadow-[0_2px_10px_rgba(0,0,0,0.4)]"
                      style={{
                        background: color,
                        color: readableTextOn(color),
                        width: orbit.rank,
                        height: orbit.rank,
                        fontSize: Math.round(orbit.rank * 0.46),
                      }}
                    >
                      {i + 1}
                    </span>
                  ) : null}
                </div>

                <span
                  className={`max-w-full shrink-0 rounded-full px-2.5 py-0.5 text-center ${orbit.name} leading-tight font-bold break-words ${badge}`}
                >
                  {team.name}
                </span>
                {showScores ? (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0 ${orbit.score} font-black tabular-nums ${badge}`}
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
          {/* The position number is itself the standing, so it goes with the
              scores. A plain colour disc keeps the row's rhythm. */}
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-base font-black tabular-nums"
            style={{
              background: team.color ?? '#888',
              color: readableTextOn(team.color ?? '#888'),
            }}
          >
            {showScores ? i + 1 : ''}
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
            {/* The bar length is the score drawn as a picture, so it hides
                with the number rather than leaking the gap between teams. */}
            {showScores ? (
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(team.score / maxScore) * 100}%`,
                    background: team.color ?? '#FFC107',
                  }}
                />
              </div>
            ) : null}
          </div>
          {showScores ? (
            <span className="text-2xl font-black tabular-nums">{team.score}</span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
