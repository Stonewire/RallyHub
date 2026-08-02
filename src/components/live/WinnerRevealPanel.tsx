import confetti from 'canvas-confetti'
import { motion } from 'framer-motion'
import { useEffect } from 'react'

type WinnerRevealPanelProps = {
  stage: 1 | 2
  /** Full event leaderboard (by team.score) */
  ranked: { team: { id: string; name: string | null; score: number; color: string | null; photo_url: string | null }; rank: number }[]
  myTeamId: string
  /** Quiz-only points when on quiz results; optional for event winner */
  quizPoints?: number
}

/**
 * Winning green, the same one a right answer wears through the quiz and a
 * completed line wears on the bingo card. Deliberately not the event accent:
 * on an event whose accent is a soft gold this read as washed out, and green
 * says winner in a way a brand colour cannot.
 */
const WINNER_GREEN = '#16A34A'

/** Split so each letter can land on its own beat, as the bingo win does. */
const WINNER_LETTERS = ['W', 'I', 'N', 'N', 'E', 'R', '!']

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
    // Three deliberate bursts rather than a particle stream: the same
    // celebration the bingo win plays, and kind to a phone that is also
    // receiving realtime updates.
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    confetti({
      particleCount: reducedMotion ? 30 : 90,
      spread: 105,
      startVelocity: 45,
      origin: { y: 0.5 },
      disableForReducedMotion: true,
    })
    const sides = window.setTimeout(() => {
      if (reducedMotion) return
      confetti({ particleCount: 26, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } })
      confetti({ particleCount: 26, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } })
    }, 300)
    const finale = window.setTimeout(() => {
      if (reducedMotion) return
      confetti({ particleCount: 50, spread: 110, startVelocity: 38, origin: { y: 0.6 } })
    }, 1000)
    return () => {
      window.clearTimeout(sides)
      window.clearTimeout(finale)
    }
  }, [stage, isWinner])

  if (stage === 1) {
    // The drum roll: nothing on screen but the sentence, set large enough to
    // fill it and weighted so the two words that matter carry the moment.
    return (
      <div className="flex min-h-[78svh] flex-col items-center justify-center px-6 text-center">
        <p className="text-[clamp(1rem,3.5vw,1.75rem)] leading-none font-black tracking-[0.35em] uppercase opacity-60">
          It is
        </p>
        <p className="mt-2 text-[clamp(3.5rem,17vw,10rem)] leading-[0.9] font-black drop-shadow-lg">
          TIME
        </p>
        <p className="mt-3 text-[clamp(1rem,3.5vw,1.75rem)] leading-tight font-black tracking-[0.22em] uppercase opacity-75">
          to announce the
        </p>
        {/* The word the room is waiting for, in the winning green. */}
        <p
          className="mt-2 animate-pulse text-[clamp(3rem,14vw,8.5rem)] leading-[0.9] font-black drop-shadow-lg"
          style={{ color: WINNER_GREEN }}
        >
          WINNER
        </p>
      </div>
    )
  }

  const totalPoints = quizPoints ?? mine?.team.score ?? 0

  return (
    <div className="flex min-h-[78svh] flex-col items-center justify-center px-6 text-center">
      <motion.p
        className="text-[clamp(0.95rem,3.2vw,1.5rem)] leading-none font-black tracking-[0.3em] uppercase opacity-70"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 0.7 }}
        transition={{ type: 'spring', stiffness: 220, damping: 16 }}
      >
        {isWinner ? 'Congratulations' : myRank > 0 ? 'Well played' : 'Results'}
      </motion.p>

      {isWinner ? (
        <div className="mt-3 flex flex-col items-center">
          <motion.p
            className="text-[clamp(1.4rem,5vw,2.5rem)] leading-none font-black"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 220, damping: 14 }}
          >
            YOU ARE THE
          </motion.p>
          {/* Letter by letter, exactly as the bingo win plays it. */}
          <div className="flex items-end justify-center">
            {WINNER_LETTERS.map((letter, i) => (
              <motion.span
                key={`${letter}-${i}`}
                className="text-[clamp(3rem,13.5vw,8rem)] leading-[0.9] font-black drop-shadow-lg"
                style={{ color: WINNER_GREEN }}
                initial={{ scale: 0, rotate: -45, opacity: 0 }}
                animate={{
                  scale: [0, 1.3, 1],
                  rotate: [-45, 8, 0],
                  opacity: 1,
                  y: [0, -10, 0, -14, 0],
                }}
                transition={{
                  delay: 0.3 + i * 0.12,
                  duration: 1.6,
                  times: [0, 0.25, 0.45, 0.72, 1],
                  repeat: Infinity,
                  repeatDelay: 0.6,
                }}
              >
                {letter}
              </motion.span>
            ))}
          </div>
        </div>
      ) : (
        <motion.p
          className="mt-3 text-[clamp(2.5rem,12vw,7rem)] leading-[0.95] font-black drop-shadow-lg"
          style={{ color: WINNER_GREEN }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 15 }}
        >
          {myRank > 0 ? (RANK_LABELS[myRank] ?? `#${myRank}`) : 'Results'}
        </motion.p>
      )}

      {!isWinner && myRank > 0 ? (
        <motion.p
          className="mt-4 text-[clamp(0.95rem,3.2vw,1.35rem)] font-bold opacity-75"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.75 }}
          transition={{ delay: 0.5 }}
        >
          {myRank <= 3 ? 'So close!' : 'Thanks for playing!'}
        </motion.p>
      ) : null}

      {myRank > 0 ? (
        <motion.div
          className="mt-10 flex flex-col items-center"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, type: 'spring', stiffness: 200, damping: 16 }}
        >
          <span className="text-[clamp(2.5rem,10vw,5rem)] leading-none font-black tabular-nums drop-shadow-lg">
            {totalPoints}
          </span>
          <span className="mt-2 text-[clamp(0.8rem,2.6vw,1.1rem)] font-black tracking-[0.28em] uppercase opacity-65">
            {quizPoints != null ? 'quiz points' : 'total points'}
          </span>
        </motion.div>
      ) : null}
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- ranking helper shared with WinnerRevealPanel's callers
export function eventRankedTeams(
  teams: { id: string; name: string | null; score: number; color: string | null; photo_url: string | null }[],
) {
  return [...teams]
    .filter((t) => t.name?.trim())
    .sort((a, b) => b.score - a.score)
    .map((team, i) => ({ team, rank: i + 1 }))
}
