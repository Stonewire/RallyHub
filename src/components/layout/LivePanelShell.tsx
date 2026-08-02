import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type LivePanelShellProps = {
  title: string
  subtitle?: ReactNode
  headerExtra?: ReactNode
  children: ReactNode
  className?: string
  titleCentered?: boolean
}

/** Admin-matched shell for facilitator / join / tablet control panels. */
export function LivePanelShell({
  title,
  subtitle,
  headerExtra,
  children,
  className,
  titleCentered,
}: LivePanelShellProps) {
  return (
    <div className={cn('bg-background text-foreground min-h-screen', className)}>
      <div
        className={cn(
          'mx-auto w-full max-w-6xl px-6 sm:px-8',
          // Headless panels start at the top; the heading's breathing room went
          // with it.
          title ? 'py-6' : 'py-3',
          className,
        )}
      >
        {/* An empty title means the panel owns its own top row: the facilitator
            console needs the vertical space more than it needs a heading that
            repeats what its display preview already says. */}
        {title ? (
          <header
            className={cn(
              'mb-6',
              titleCentered ? 'text-center' : 'flex flex-col gap-2',
            )}
          >
            <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
              {title}
            </h1>
            {subtitle ? (
              <div className="text-muted-foreground mt-1 text-sm">{subtitle}</div>
            ) : null}
            {headerExtra ? (
              <div className={cn('mt-3', titleCentered && 'flex justify-center')}>
                {headerExtra}
              </div>
            ) : null}
          </header>
        ) : null}
        {children}
      </div>
    </div>
  )
}
