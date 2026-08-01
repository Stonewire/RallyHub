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
 * Sizing is left to the caller via className, on a two-step scale:
 *   size-4    normal buttons, nav rows, anything with a text label beside it
 *   size-3.5  compact icon-only buttons inside cards and table rows
 * Anything larger (size-8 and up) is an illustration, not an icon: empty
 * states and feature tiles. Stick to those and the panel stays even.
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
      // size-4 by default. lucide carried width/height={24} attributes, so a
      // call site that forgot a size class still rendered at 24px; an SVG with
      // neither attribute nor class stretches to fill its container instead,
      // which is how a missed site turns into a giant icon.
      className={cn('size-4 shrink-0', className)}
      {...props}
    >
      {children}
    </svg>
  )
}
