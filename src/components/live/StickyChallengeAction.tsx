import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Holds a challenge's main action at a fixed spot just above the bottom
 * furniture (chat, exit and the RallyHub badge). It never moves with the
 * content: the whole point is that the action is always in the same place,
 * within thumb reach, however long the brief is and wherever the team has
 * scrolled to.
 *
 * Rendered into the body, like the chat and exit buttons, so no transformed
 * ancestor can capture the fixed positioning.
 *
 * Pair with `STICKY_ACTION_SPACER` on the scrolling content so the last of it
 * can still be read clear of the button.
 */
export const STICKY_ACTION_SPACER = 'pb-40'

/** One size for every challenge's main action button. */
export const CHALLENGE_ACTION_CLASS =
  'mx-auto w-full max-w-sm gap-2 px-6 py-5 text-base shadow-xl'

export function StickyChallengeAction({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="experience-scope pointer-events-none fixed inset-x-0 bottom-[5.25rem] z-[9998] px-4">
      <div className="pointer-events-auto flex justify-center">{children}</div>
    </div>,
    document.body,
  )
}
