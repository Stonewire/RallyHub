import { Crown } from 'lucide-react'

import type { QuizLeaderboardEntry } from '@/lib/live-event'

type QuizResultsPanelProps = {
  title?: string
  entries: QuizLeaderboardEntry[]
  highlightTeamId?: string
  large?: boolean
}

/**
 * The podium reads as a ladder rather than as medals: the winner takes the
 * same green that marks a right answer, second and third are brighter panels
 * than the rest. Borrowed silver and bronze belonged to no palette here.
 */
const WINNER_GREEN = '#16A34A'

const PODIUM_ROW: Record<number, string> = {
  0: 'text-white',
  1: 'bg-white/35 text-white',
  2: 'bg-white/22 text-white',
}

const PODIUM_WORD = ['first', 'second', 'third']

export function QuizResultsPanel({
  title = 'Quiz results',
  entries,
  highlightTeamId,
  large = false,
}: QuizResultsPanelProps) {
  const myIndex = entries.findIndex((entry) => entry.team.id === highlightTeamId)
  const myEntry = myIndex >= 0 ? entries[myIndex] : null

  return (
    <div className={`mx-auto w-full px-3 ${large ? 'max-w-5xl py-8' : 'max-w-2xl pb-24'}`}>
      <h2
        className={`text-center leading-tight font-black ${
          large ? 'text-4xl md:text-6xl' : 'text-[clamp(1.6rem,5vw,2.5rem)]'
        }`}
      >
        {title}
      </h2>

      {/* Finishing on the podium is the moment worth marking, so it is said in
          words rather than left to the colour of a row. */}
      {myEntry ? (
        <p className="mt-2 mb-5 text-center text-base font-bold text-balance opacity-90 sm:text-lg">
          {myIndex === 0
            ? 'Congratulations, you won the quiz!'
            : myIndex < 3
              ? `Congratulations, you finished ${PODIUM_WORD[myIndex]}!`
              : `You finished #${myIndex + 1}`}
        </p>
      ) : (
        <div className="mb-5" />
      )}

      <ul className={`space-y-2 ${large ? 'text-lg' : 'text-base'}`}>
        {entries.map(({ team, quizPoints }, i) => {
          const mine = team.id === highlightTeamId
          const podium = PODIUM_ROW[i]
          const first = i === 0
          return (
            <li
              key={team.id}
              className={`xp-results-row flex items-center gap-3 px-4 ${
                first ? 'py-4 sm:py-5' : 'py-3 sm:py-4'
              } ${podium ?? 'bg-white/12 text-white'} ${mine ? 'ring-2 ring-white' : ''}`}
              style={first ? { backgroundColor: WINNER_GREEN } : undefined}
            >
              {first ? (
                <Crown className="size-6 shrink-0 fill-current sm:size-7" aria-label="Winner" />
              ) : null}
              <span
                className={`w-8 shrink-0 font-black tabular-nums ${
                  first ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'
                } ${podium ? '' : 'opacity-70'}`}
              >
                {i + 1}
              </span>
              {team.photo_url ? (
                <img
                  src={team.photo_url}
                  alt={team.name ?? ''}
                  className={`shrink-0 rounded-full object-cover ${
                    large ? 'size-12' : first ? 'size-11' : 'size-9'
                  }`}
                />
              ) : (
                <div
                  className={`shrink-0 rounded-full ${
                    large ? 'size-12' : first ? 'size-11' : 'size-9'
                  }`}
                  style={{ background: team.color ?? '#666' }}
                />
              )}
              <span className="min-w-0 flex-1 truncate font-bold">{team.name}</span>
              <span
                className={`shrink-0 font-black tabular-nums ${
                  first ? 'text-xl sm:text-2xl' : 'text-lg'
                }`}
              >
                {quizPoints}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
