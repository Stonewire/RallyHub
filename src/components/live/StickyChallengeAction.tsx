import type { ReactNode } from 'react'

/**
 * Holds a challenge's main action just above the bottom furniture (chat, exit
 * and the RallyHub badge) so it stays one tap away however long the brief
 * runs, and comes to rest below the content at the end of the screen.
 *
 * Pair with `STICKY_ACTION_SPACER` on the scrolling container.
 */
export const STICKY_ACTION_SPACER = 'pb-32'

/** One size for every challenge's main action button. */
export const CHALLENGE_ACTION_CLASS =
  'mx-auto w-full max-w-sm gap-2 px-6 py-5 text-base'

export function StickyChallengeAction({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[5.5rem] z-20 mt-6 px-4">{children}</div>
  )
}
