import { Medal } from 'lucide-react'

import { displayTextClass } from '@/lib/live-event'
import type { Tables } from '@/types/helpers'

type DisplayPodiumProps = {
  event: Tables<'events'>
  teams: Tables<'teams'>[]
}

const MEDALS = ['🥇', '🥈', '🥉'] as const
const PODIUM_ORDER = [1, 0, 2] as const
const BAR_HEIGHTS = [140, 200, 110] as const

export function DisplayPodium({ event, teams }: DisplayPodiumProps) {
  const textClass = displayTextClass(event)
  const ranked = [...teams]
    .filter((t) => t.name?.trim())
    .sort((a, b) => b.score - a.score)
  const top3 = ranked.slice(0, 3)
  const rest = ranked.slice(3)

  return (
    <div className={`flex w-full flex-col items-center gap-10 ${textClass}`}>
      <div className="flex w-full max-w-4xl items-end justify-center gap-4 md:gap-8">
        {PODIUM_ORDER.map((rankIndex, col) => {
          const team = top3[rankIndex]
          if (!team) {
            return <div key={col} className="w-24 md:w-32" />
          }
          const place = rankIndex + 1
          const barH = BAR_HEIGHTS[col]
          return (
            <div
              key={team.id}
              className="flex min-w-0 flex-1 max-w-[200px] flex-col items-center gap-2"
            >
              <span className="text-3xl md:text-4xl" aria-hidden>
                {MEDALS[rankIndex]}
              </span>
              <div
                className="relative flex items-center justify-center rounded-full ring-4 ring-white/30"
                style={{
                  width: place === 1 ? 100 : 80,
                  height: place === 1 ? 100 : 80,
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
                    className="size-full rounded-full opacity-90"
                    style={{ background: team.color ?? '#666' }}
                  />
                )}
              </div>
              <p className="max-w-full truncate text-center text-sm font-bold md:text-base">
                {team.name}
              </p>
              <p className="text-lg font-bold tabular-nums md:text-xl">{team.score} pts</p>
              <div
                className="xp-podium-bar mt-1 flex w-full items-end justify-center rounded-t-lg bg-white/20 backdrop-blur-sm"
                style={{ height: barH }}
              >
                <span className="pb-2 text-2xl font-bold opacity-90 md:text-3xl">
                  #{place}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {rest.length > 0 ? (
        <div className="w-full max-w-5xl border-t border-white/15 pt-8">
          <p className="mb-4 flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-wide opacity-70">
            <Medal className="size-4" />
            All teams
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {rest.map((team, i) => (
              <li
                key={team.id}
                className="xp-team-tile flex flex-col items-center gap-1.5 bg-white/10 px-2 py-3 text-center backdrop-blur-sm"
              >
                {team.photo_url ? (
                  <img
                    src={team.photo_url}
                    alt=""
                    className="size-12 rounded-full object-cover ring-2 ring-white/20"
                  />
                ) : (
                  <div
                    className="size-12 rounded-full ring-2 ring-white/20"
                    style={{ background: team.color ?? '#666' }}
                  />
                )}
                <span className="line-clamp-2 text-xs font-semibold leading-tight">
                  {team.name}
                </span>
                <span className="text-xs tabular-nums opacity-80">
                  #{i + 4} · {team.score} pts
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
