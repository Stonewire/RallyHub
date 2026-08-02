import { createPortal } from 'react-dom'

import type { DevQuizStep } from '@/lib/dev-quiz-steps'

/**
 * Development-only quiz driver, enabled with `?devbar=1`.
 *
 * Reviewing the quiz screens otherwise means running a facilitator console in
 * another window and keeping the two in step. This walks every screen the quiz
 * stage can show, in the order a facilitator produces them, patching the local
 * bundle only: nothing is written to the event, so it cannot disturb a real
 * one.
 *
 * Never reaches production: the caller is behind `import.meta.env.DEV`.
 */
type Props = {
  steps: DevQuizStep[]
  index: number
  onGo: (index: number) => void
  onRestartTimer: () => void
}

export function DevQuizBar({ steps, index, onGo, onRestartTimer }: Props) {
  if (typeof document === 'undefined' || steps.length === 0) return null
  const step = steps[Math.min(index, steps.length - 1)]

  return createPortal(
    <div className="fixed inset-x-0 top-0 z-[10000] flex flex-wrap items-center justify-center gap-2 bg-black/85 px-3 py-1.5 text-white backdrop-blur-sm">
      <button
        type="button"
        disabled={index === 0}
        onClick={() => onGo(index - 1)}
        className="rounded bg-white/15 px-3 py-1 text-xs font-bold disabled:opacity-35"
      >
        ← Prev
      </button>
      <span className="min-w-36 text-center text-xs font-semibold tabular-nums">
        {step.label}{' '}
        <span className="opacity-60">
          ({index + 1}/{steps.length})
        </span>
      </span>
      <button
        type="button"
        disabled={index >= steps.length - 1}
        onClick={() => onGo(index + 1)}
        className="rounded bg-white/15 px-3 py-1 text-xs font-bold disabled:opacity-35"
      >
        Next →
      </button>
      <button
        type="button"
        onClick={onRestartTimer}
        className="text-nm-yellow rounded bg-white/15 px-3 py-1 text-xs font-bold"
      >
        Restart timer
      </button>
      <button
        type="button"
        onClick={() => onGo(0)}
        className="rounded bg-white/15 px-3 py-1 text-xs font-bold"
      >
        Back to start
      </button>
    </div>,
    document.body,
  )
}
