import type { SVGProps } from 'react'

import { cn } from '@/lib/utils'

export type RhIconProps = SVGProps<SVGSVGElement>

/**
 * Base for the RallyHub icon set.
 *
 * Every icon is drawn on the same 24x24 grid with a 1.75 stroke, round caps and
 * round joins, and no fill. Keeping those on the wrapper rather than on each
 * path is the whole point: the weight cannot drift icon by icon, which is what
 * happened with the mixed 1.75 / 1.8 / 2 strokes this set replaces.
 *
 * Sizing is left to the caller via className (size-4 in buttons, size-5 in nav),
 * so the icons inherit the same scale rules as the rest of the layout.
 */
export function RhIcon({ className, children, ...props }: RhIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={cn('shrink-0', className)}
      {...props}
    >
      {children}
    </svg>
  )
}
