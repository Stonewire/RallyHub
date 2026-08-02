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
 * Winning green: brighter than the green a marked answer wears, because this
 * one is the celebration rather than a status. Deliberately not the event
 * accent — on an event whose accent is a soft gold the word washed out, and
 * green says winner in a way a brand colour cannot.
 */
const WINNER_GREEN = '#22DD62'

/**
 * A white contour keeps the word readable whatever the event's background
 * happens to be behind it. paint-order puts the fill above the stroke, so the
 * letterforms stay their own weight rather than thinning.
 */
/**
 * The outline is drawn as copies of the word offset around a circle rather
 * than with text-stroke. A stroke follows the letterform exactly, so on the
 * app's own heavy face it came back with hard corners; sampling a circle
 * rounds every corner by construction, and the face itself is untouched.
 */
function roundedOutline(radiusEm: number, steps = 32): string {
  return Array.from({ length: steps }, (_, i) => {
    const angle = (i / steps) * Math.PI * 2
    const x = (Math.cos(angle) * radiusEm).toFixed(4)
    const y = (Math.sin(angle) * radiusEm).toFixed(4)
    return `${x}em ${y}em 0 #ffffff`
  }).join(', ')
}

const WINNER_OUTLINE = {
  textShadow: `${roundedOutline(0.11)}, 0 0.06em 0.12em rgba(0,0,0,0.45)`,
  // Room for the outline: without it neighbouring letters merge into one.
  paddingInline: '0.12em',
} as const

/** Split so each letter can land on its own beat, as the bingo win does. */
const WINNER_LETTERS = ['W', 'I', 'N', 'N', 'E', 'R', '!']

/** The placing, spelt out so it can land letter by letter like WINNER. */
function rankLetters(rank: number): string[] {
  if (rank <= 0) return Array.from('RESULTS')
  return Array.from(`#${rank}`)
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
  const teamColor = mine?.team.color?.trim() || '#FFFFFF'

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
    // Keeps firing while the screen is up: this one stays on until the
    // facilitator moves on, so a single burst would leave it still.
    const loop = reducedMotion
      ? null
      : window.setInterval(() => {
          confetti({ particleCount: 18, angle: 60, spread: 62, origin: { x: 0, y: 0.75 } })
          confetti({ particleCount: 18, angle: 120, spread: 62, origin: { x: 1, y: 0.75 } })
          confetti({ particleCount: 28, spread: 100, startVelocity: 34, origin: { y: 0.45 } })
        }, 2200)
    return () => {
      window.clearTimeout(sides)
      if (loop) window.clearInterval(loop)
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
          className="mt-2 animate-pulse text-[clamp(3rem,14vw,8.5rem)] leading-[0.9] font-black"
          style={{ color: WINNER_GREEN, ...WINNER_OUTLINE }}
        >
          WINNER
        </p>
      </div>
    )
  }

  const totalPoints = quizPoints ?? mine?.team.score ?? 0

  return (
    <div className="flex min-h-[80svh] flex-col items-center justify-between px-6 pt-4 pb-2 text-center">
      <motion.p
        className="text-[clamp(0.95rem,3.2vw,1.5rem)] leading-none font-black tracking-[0.3em] uppercase opacity-70"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 0.7 }}
        transition={{ type: 'spring', stiffness: 220, damping: 16 }}
      >
        {isWinner ? 'Congratulations' : myRank > 0 ? 'Well played' : 'Results'}
      </motion.p>

      {isWinner ? (
        <>
          <motion.p
            className="mt-3 text-[clamp(1.4rem,5vw,2.5rem)] leading-none font-black"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 220, damping: 14 }}
          >
            YOU ARE THE
          </motion.p>

          {/* The word sits dead centre; the lines above and the total below
              are pushed out to the ends of the screen. */}
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-end justify-center">
              {WINNER_LETTERS.map((letter, i) => (
                // Two layers: the letter lands once, then only the bounce
                // loops. Repeating the landing made each letter vanish and pop
                // back, so the word was never whole.
                <motion.span
                  key={`${letter}-${i}`}
                  className="inline-block"
                  animate={{ y: [0, -10, 0, -14, 0] }}
                  transition={{
                    delay: 0.3 + i * 0.12,
                    duration: 1.6,
                    times: [0, 0.25, 0.45, 0.72, 1],
                    repeat: Infinity,
                    repeatDelay: 0.6,
                  }}
                >
                  <motion.span
                    className="inline-block text-[clamp(3rem,13.5vw,8rem)] leading-[0.9] font-black"
                    style={{ color: WINNER_GREEN, ...WINNER_OUTLINE }}
                    initial={{ scale: 0, rotate: -45, opacity: 0 }}
                    animate={{ scale: [0, 1.3, 1], rotate: [-45, 8, 0], opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.12, duration: 0.6, times: [0, 0.6, 1] }}
                  >
                    {letter}
                  </motion.span>
                </motion.span>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <motion.p
            className="mt-3 text-[clamp(1.4rem,5vw,2.5rem)] leading-none font-black"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 220, damping: 14 }}
          >
            YOU FINISHED
          </motion.p>

          {/* Same shape as the winner's: the placing dead centre, outlined so
              it reads over any background, in the team's own colour rather
              than the winning green. */}
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-end justify-center">
              {rankLetters(myRank).map((letter, i) => (
                <motion.span
                  key={`${letter}-${i}`}
                  className="inline-block"
                  animate={{ y: [0, -8, 0] }}
                  transition={{
                    delay: 0.3 + i * 0.12,
                    duration: 1.8,
                    times: [0, 0.4, 1],
                    repeat: Infinity,
                    repeatDelay: 1.2,
                  }}
                >
                  <motion.span
                    className="inline-block text-[clamp(3rem,13.5vw,8rem)] leading-[0.9] font-black"
                    style={{ color: teamColor, ...WINNER_OUTLINE }}
                    initial={{ scale: 0, rotate: -45, opacity: 0 }}
                    animate={{ scale: [0, 1.3, 1], rotate: [-45, 8, 0], opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.12, duration: 0.6, times: [0, 0.6, 1] }}
                  >
                    {letter}
                  </motion.span>
                </motion.span>
              ))}
            </div>
          </div>
        </>
      )}

      {myRank > 0 ? (
        <motion.div
          className="mb-4 flex flex-col items-center"
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
