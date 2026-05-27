import confetti from 'canvas-confetti'
import { useEffect } from 'react'

type WinnerRevealPanelProps = {
  stage: 1 | 2
  /** Full event leaderboard (by team.score) */
  ranked: { team: { id: string; name: string | null; score: number; color: string | null; photo_url: string | null }; rank: number }[]
  myTeamId: string
  /** Quiz-only points when on quiz results; optional for event winner */
  quizPoints?: number
}

const RANK_LABELS: Record<number, string> = {
  1: '1st place',
  2: '2nd place',
  3: '3rd place',
}

export function WinnerRevealPanel({
  stage,
  ranked,
  myTeamId,
  quizPoints,
}: WinnerRevealPanelProps) {
  const mine = ranked.find((r) => r.team.id === myTeamId)
  const myRank = mine?.rank ?? 0
  const isWinner = myRank === 1

  useEffect(() => {
    if (stage !== 2 || !isWinner) return
    const end = Date.now() + 3000
    const frame = () => {
      confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 } })
      confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 } })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }, [stage, isWinner])

  if (stage === 1) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
        <p className="animate-pulse text-2xl font-bold sm:text-3xl">
          It is time to announce the winners…
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-12 text-center">
      {isWinner ? (
        <>
          <p className="mb-2 text-4xl font-black tracking-tight text-[#FFCB03] drop-shadow-lg sm:text-5xl">
            YOU ARE THE WINNER!
          </p>
          <p className="mb-6 text-lg text-white/90">Congratulations!</p>
        </>
      ) : (
        <>
          <p className="mb-2 text-2xl font-bold text-white/90">
            {myRank === 2 || myRank === 3
              ? (RANK_LABELS[myRank] ?? `#${myRank}`)
              : myRank > 0
                ? `You finished #${myRank}`
                : 'Results'}
          </p>
          <p className="mb-6 text-sm text-white/70">
            {myRank === 2 || myRank === 3
              ? 'So close — great effort!'
              : myRank > 0
                ? 'You did not win this time.'
                : ''}
          </p>
        </>
      )}
      {myRank > 0 ? (
        <p className="text-lg font-semibold tabular-nums">
          {quizPoints != null ? `${quizPoints} quiz points` : `${mine?.team.score ?? 0} total points`}
        </p>
      ) : null}
    </div>
  )
}

export function eventRankedTeams(
  teams: { id: string; name: string | null; score: number; color: string | null; photo_url: string | null }[],
) {
  return [...teams]
    .filter((t) => t.name?.trim())
    .sort((a, b) => b.score - a.score)
    .map((team, i) => ({ team, rank: i + 1 }))
}
