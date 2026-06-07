import { useMemo } from 'react'

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

export function Leaderboard({
  teams,
  showScores,
  layout,
  textClass = 'text-white',
}: LeaderboardProps) {
  const ranked = [...teams]
    .filter((t) => t.name)
    .sort((a, b) => b.score - a.score)

  const orbit = useMemo(() => orbitGrid(ranked.length), [ranked.length])

  if (layout === 'orbit_view') {
    const maxScore = Math.max(1, ...ranked.map((t) => t.score))
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center px-8 py-10">
        <div
          className="grid w-full max-w-6xl place-items-center justify-items-center gap-x-6 gap-y-8"
          style={{
            gridTemplateColumns: `repeat(${orbit.cols}, minmax(0, 1fr))`,
          }}
        >
          {ranked.map((team, i) => {
            const scoreRatio = team.score / maxScore
            // When scores are hidden, render uniform bubbles so the size does not
            // reveal standings — only the numeric score is gated by showScores.
            const size = showScores
              ? Math.round(orbit.maxPx * (0.72 + scoreRatio * 0.28))
              : Math.round(orbit.maxPx * 0.86)
            return (
              <div
                key={team.id}
                className={`flex w-full max-w-[${orbit.maxPx}px] flex-col items-center gap-2 ${textClass}`}
                style={{ maxWidth: orbit.maxPx }}
              >
                <div
                  className="xp-team-tile relative flex shrink-0 items-center justify-center rounded-full"
                  style={{
                    width: size,
                    height: size,
                    boxShadow: `0 0 0 4px ${team.color ?? '#888'}`,
                  }}
                >
                  {team.photo_url ? (
                    <img
                      src={team.photo_url}
                      alt=""
                      className="size-full rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="size-full rounded-full opacity-80"
                      style={{ background: team.color ?? '#666' }}
                    />
                  )}
                </div>
                <span className="max-w-full truncate text-center text-sm font-medium">
                  {team.name}
                </span>
                {showScores ? (
                  <span className="text-xs opacity-70">{team.score}</span>
                ) : null}
                {showScores ? (
                  <span className="text-[10px] opacity-40">#{i + 1}</span>
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
    <ul className={`mx-auto w-full max-w-2xl space-y-3 px-4 py-6 ${textClass}`}>
      {ranked.map((team, i) => (
        <li
          key={team.id}
          className={`xp-leaderboard-row flex items-center gap-4 bg-white/10 px-4 py-3 backdrop-blur-sm`}
        >
          <span className="w-8 text-lg font-bold opacity-60">{i + 1}</span>
          {team.photo_url ? (
            <img
              src={team.photo_url}
              alt=""
              className="size-10 rounded-full object-cover"
            />
          ) : (
            <div
              className="size-10 rounded-full"
              style={{ background: team.color ?? '#666' }}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{team.name}</p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(team.score / maxScore) * 100}%`,
                  background: team.color ?? '#FFCB03',
                }}
              />
            </div>
          </div>
          {showScores ? (
            <span className="text-xl font-bold tabular-nums">{team.score}</span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
