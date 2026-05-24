import type { Tables } from '@/types/helpers'

type LeaderboardProps = {
  teams: Tables<'teams'>[]
  showScores: boolean
  layout: 'rank_list' | 'orbit_view'
}

export function Leaderboard({ teams, showScores, layout }: LeaderboardProps) {
  const ranked = [...teams]
    .filter((t) => t.name)
    .sort((a, b) => b.score - a.score)

  if (layout === 'orbit_view') {
    const maxScore = Math.max(1, ...ranked.map((t) => t.score))
    return (
      <div className="flex min-h-[50vh] flex-wrap items-center justify-center gap-6 px-4 py-8">
        {ranked.map((team, i) => {
          const size = 72 + (team.score / maxScore) * 56
          return (
            <div key={team.id} className="flex flex-col items-center gap-2">
              <div
                className="relative flex items-center justify-center rounded-full"
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
              <span className="max-w-[8rem] truncate text-center text-sm font-medium">
                {team.name}
              </span>
              {showScores ? (
                <span className="text-xs text-white/70">{team.score}</span>
              ) : null}
              <span className="text-[10px] text-white/40">#{i + 1}</span>
            </div>
          )
        })}
      </div>
    )
  }

  const maxScore = Math.max(1, ...ranked.map((t) => t.score))

  return (
    <ul className="mx-auto w-full max-w-2xl space-y-3 px-4 py-6">
      {ranked.map((team, i) => (
        <li
          key={team.id}
          className="flex items-center gap-4 rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm"
        >
          <span className="w-8 text-lg font-bold text-white/60">{i + 1}</span>
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
