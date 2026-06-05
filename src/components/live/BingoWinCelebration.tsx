import confetti from 'canvas-confetti'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'

import { textOnAccent } from '@/lib/live-event'
import { playBingoWinSequence, playLoserSound } from '@/lib/sounds'

const DEFAULT_ACCENT = '#FFCB03'

type BingoWinCelebrationProps = {
  teamName: string
  teamColor?: string | null
  /** When true, show the personal "You got BINGO!" version on the winner's own device. */
  mine?: boolean
  /** When true, this is the display panel (always plays the full winner sequence). */
  display?: boolean
  /** Auto-dismiss after this many ms (default 8000). */
  durationMs?: number
  onDismiss: () => void
}

const LETTERS = ['B', 'I', 'N', 'G', 'O']

export function BingoWinCelebration({
  teamName,
  teamColor,
  mine = false,
  display = false,
  durationMs = 8000,
  onDismiss,
}: BingoWinCelebrationProps) {
  const accent = teamColor?.trim() || DEFAULT_ACCENT
  const onColor = textOnAccent(accent)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss
  // Ensure the celebration sound sequence fires exactly once per win, never on
  // re-render.
  const soundFiredRef = useRef(false)

  useEffect(() => {
    if (!soundFiredRef.current) {
      soundFiredRef.current = true
      // Display panel always plays the full winner sequence (with cheer +
      // fireworks). On phones: the winning team hears winner→celebration, every
      // other team hears the loser sound.
      if (display || mine) {
        playBingoWinSequence(display)
      } else {
        playLoserSound()
      }
    }

    const end = Date.now() + 3200
    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0 } })
      confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1 } })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
    confetti({ particleCount: 140, spread: 100, startVelocity: 45, origin: { y: 0.5 } })

    const timer = window.setTimeout(() => onDismissRef.current(), durationMs)
    return () => window.clearTimeout(timer)
    // Run once when the celebration appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[10000] flex flex-col items-center justify-center px-6 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          background:
            'radial-gradient(circle at center, rgba(0,0,0,0.82), rgba(0,0,0,0.94))',
        }}
        onClick={onDismiss}
      >
        <motion.p
          className="mb-3 text-lg font-semibold uppercase tracking-[0.3em] text-white/80 sm:text-2xl"
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 220, damping: 16 }}
        >
          {mine ? 'You got' : 'Bingo!'}
        </motion.p>

        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {LETTERS.map((letter, i) => (
            <motion.span
              key={letter}
              className="font-display text-6xl font-black drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)] sm:text-8xl md:text-9xl"
              style={{ color: accent }}
              initial={{ scale: 0, rotate: -45, opacity: 0 }}
              animate={{
                scale: [0, 1.3, 1],
                rotate: [-45, 8, 0],
                opacity: 1,
                y: [0, -10, 0],
              }}
              transition={{
                delay: 0.15 + i * 0.12,
                duration: 0.6,
                times: [0, 0.6, 1],
                repeat: Infinity,
                repeatType: 'reverse',
                repeatDelay: 1.4,
              }}
            >
              {letter}
            </motion.span>
          ))}
        </div>

        <motion.div
          className="mt-8 inline-flex max-w-[90vw] items-center gap-3 rounded-full px-6 py-3 shadow-2xl"
          style={{ backgroundColor: accent, color: onColor }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 200, damping: 14 }}
        >
          <span
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: onColor, opacity: 0.5 }}
          />
          <span className="truncate text-2xl font-extrabold sm:text-4xl">{teamName}</span>
        </motion.div>

        <motion.p
          className="mt-5 text-base text-white/85 sm:text-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {mine ? 'Congratulations — you completed a bingo!' : 'has got BINGO!'}
        </motion.p>
      </motion.div>
    </AnimatePresence>
  )
}
