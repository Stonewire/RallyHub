import confetti from 'canvas-confetti'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { textOnAccent } from '@/lib/live-event'

const DEFAULT_ACCENT = '#FFC107'

type BingoWinCelebrationProps = {
  teamName: string
  teamColor?: string | null
  /** When true, show the personal "You got BINGO!" version on the winner's own device. */
  mine?: boolean
  /** Auto-dismiss after this many ms (default 8000). */
  durationMs?: number
  /** Points the win itself paid, shown to the team that got it. */
  bonusPoints?: number | null
  onDismiss: () => void
}

export function BingoWinCelebration({
  teamName,
  teamColor,
  mine = false,
  durationMs = 8000,
  bonusPoints,
  onDismiss,
}: BingoWinCelebrationProps) {
  const { t } = useTranslation('live')
  // Split so each letter can land on its own animation beat.
  const letters = Array.from(t('bingoWin.bingoWord'))
  const accent = teamColor?.trim() || DEFAULT_ACCENT
  const onColor = textOnAccent(accent)
  const onDismissRef = useRef(onDismiss)
  // eslint-disable-next-line react-hooks/refs -- standard "keep ref fresh" idiom so the effect below can read the latest callback without re-subscribing
  onDismissRef.current = onDismiss

  useEffect(() => {
    // Winner jingle is fired on the facilitator tab only (see FacilitatorEventPage);
    // this overlay is now purely visual on players and the display.
    // Keep the celebration bounded on phones. The old requestAnimationFrame
    // stream created roughly 600 particles every second for eight seconds,
    // alongside interval bursts and infinitely repeating letter animations.
    // A few deliberate bursts look celebratory without monopolising the main
    // thread just as the winner state is arriving.
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    confetti({
      particleCount: reducedMotion ? 30 : 80,
      spread: 100,
      startVelocity: 42,
      origin: { y: 0.55 },
      disableForReducedMotion: true,
    })
    const sideBurst = window.setTimeout(() => {
      if (reducedMotion) return
      confetti({ particleCount: 22, angle: 60, spread: 58, origin: { x: 0, y: 0.7 } })
      confetti({ particleCount: 22, angle: 120, spread: 58, origin: { x: 1, y: 0.7 } })
    }, 280)
    const finalBurst = window.setTimeout(() => {
      if (reducedMotion) return
      confetti({ particleCount: 45, spread: 105, startVelocity: 36, origin: { y: 0.62 } })
    }, 900)

    const timer = window.setTimeout(() => onDismissRef.current(), durationMs)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(sideBurst)
      window.clearTimeout(finalBurst)
    }
    // Run once when the celebration appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AnimatePresence>
      {/* z-10100 sits above the display's sound gate (z-10050). A display that
          reloads mid-event sits behind that gate until someone taps it, and the
          win is the one moment the room must not miss. */}
      <motion.div
        className="experience-scope fixed inset-0 z-[10100] flex flex-col items-center justify-center px-6 text-center"
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
          {mine ? t('bingoWin.youGot') : t('bingoWin.heading')}
        </motion.p>

        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {letters.map((letter, i) => (
            // Two layers: the letter lands once, and only the bounce loops.
            // Repeating the landing made each letter vanish and pop back.
            <motion.span
              key={`${letter}-${i}`}
              className="inline-block"
              animate={{ y: [0, -10, 0, -14, 0] }}
              transition={{
                delay: 0.15 + i * 0.12,
                duration: 1.6,
                times: [0, 0.25, 0.45, 0.72, 1],
                repeat: Infinity,
                repeatDelay: 0.6,
              }}
            >
              <motion.span
                className="inline-block font-sans text-6xl font-black drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)] sm:text-8xl md:text-9xl"
                style={{ color: accent }}
                initial={{ scale: 0, rotate: -45, opacity: 0 }}
                animate={{ scale: [0, 1.3, 1], rotate: [-45, 8, 0], opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.12, duration: 0.6, times: [0, 0.6, 1] }}
              >
                {letter}
              </motion.span>
            </motion.span>
          ))}
        </div>

        <motion.div
          className="xp-celebration-pill mt-8 inline-flex max-w-[90vw] items-center gap-3 px-6 py-3 shadow-2xl"
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
          className="mt-5 text-base font-semibold text-white/85 sm:text-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {mine ? t('bingoWin.completedLine') : t('bingoWin.hasGotBingo')}
        </motion.p>

        {mine && bonusPoints ? (
          <motion.p
            className="mt-2 text-2xl font-black tabular-nums sm:text-3xl"
            style={{ color: accent }}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1, type: 'spring', stiffness: 240, damping: 12 }}
          >
            {t('puzzle.pointsAwarded', { points: bonusPoints })}
          </motion.p>
        ) : null}
      </motion.div>
    </AnimatePresence>
  )
}
