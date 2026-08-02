import type { ReactNode } from 'react'

/**
 * Holds a challenge's main action just above the bottom furniture (chat, exit
 * and the RallyHub badge) so it stays one tap away however long the brief
 * runs, and comes to rest below the content at the end of the screen.
 *
 * Pair with `STICKY_ACTION_SPACER` on the scrolling container.
 */
export const STICKY_ACTION_SPACER = 'pb-32'

export function StickyChallengeAction({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[5.5rem] z-20 mt-6 px-4">{children}</div>
  )
}
