import type { ReactNode } from 'react'

type GameFormLayoutProps = {
  /** Left column: Primary settings and any type-specific cards. */
  children: ReactNode
  /** Right column, top. Only photo and video have facilitator solutions. */
  facilitatorCard?: ReactNode
  /** Right column, bottom. Fills the remaining height. */
  groupsCard?: ReactNode
  /**
   * Forces one column. The edit side panel is ~35rem wide while xl: keys off
   * the viewport, so without this a wide screen splits the panel in two.
   */
  singleColumn?: boolean
  /** Quiz splits evenly: its designer needs as much room as its settings. */
  evenColumns?: boolean
  /** Full-width content below both columns, e.g. the quiz's rounds. */
  below?: ReactNode
}

/**
 * The shared shape of every game form: settings on the left at two thirds,
 * facilitator and groups stacked on the right.
 *
 * Columns stretch so the right stack can fill the left column's height, which
 * is what lets the groups list grow instead of leaving a gap under it.
 */
export function GameFormLayout({
  children,
  facilitatorCard,
  groupsCard,
  singleColumn,
  evenColumns,
  below,
}: GameFormLayoutProps) {
  const hasSide = Boolean(facilitatorCard || groupsCard)

  if (singleColumn || !hasSide) {
    return (
      <div className="space-y-6">
        {children}
        {facilitatorCard}
        {groupsCard}
        {below}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div
        className={
          evenColumns
            ? 'grid items-stretch gap-6 xl:grid-cols-2'
            : 'grid items-stretch gap-6 xl:grid-cols-[2fr_1fr]'
        }
      >
        <div className="space-y-6">{children}</div>
        <div className="flex flex-col gap-6">
          {facilitatorCard}
          {groupsCard}
        </div>
      </div>
      {below}
    </div>
  )
}
