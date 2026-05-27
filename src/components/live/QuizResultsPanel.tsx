import type { QuizLeaderboardEntry } from '@/lib/live-event'

type QuizResultsPanelProps = {
  title?: string
  entries: QuizLeaderboardEntry[]
  highlightTeamId?: string
  large?: boolean
}

export function QuizResultsPanel({
  title = 'Quiz results',
  entries,
  highlightTeamId,
  large = false,
}: QuizResultsPanelProps) {
  return (
    <div className={`mx-auto w-full px-4 ${large ? 'max-w-4xl py-8' : 'max-w-lg pb-24'}`}>
      <h2
        className={`mb-6 text-center font-bold ${large ? 'text-3xl md:text-5xl' : 'text-xl'}`}
      >
        {title}
      </h2>
      <ul className={`space-y-2 ${large ? 'text-lg' : 'text-sm'}`}>
        {entries.map(({ team, quizPoints }, i) => {
          const highlight = team.id === highlightTeamId
          return (
            <li
              key={team.id}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                highlight
                  ? 'bg-[#FFCB03]/90 text-[#3E3D3E] ring-2 ring-white/50'
                  : 'bg-white/10 text-white'
              }`}
            >
              <span className="w-8 font-bold tabular-nums opacity-70">#{i + 1}</span>
              {team.photo_url ? (
                <img
                  src={team.photo_url}
                  alt=""
                  className={`rounded-full object-cover ${large ? 'size-12' : 'size-8'}`}
                />
              ) : (
                <div
                  className={`rounded-full ${large ? 'size-12' : 'size-8'}`}
                  style={{ background: team.color ?? '#666' }}
                />
              )}
              <span className="min-w-0 flex-1 truncate font-semibold">{team.name}</span>
              <span className="font-mono tabular-nums">{quizPoints} pts</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
