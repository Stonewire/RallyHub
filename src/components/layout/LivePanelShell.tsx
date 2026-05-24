import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type LivePanelShellProps = {
  title: string
  subtitle?: ReactNode
  headerExtra?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
}

/** Admin-matched shell for facilitator / join / tablet control panels. */
export function LivePanelShell({
  title,
  subtitle,
  headerExtra,
  aside,
  children,
  className,
}: LivePanelShellProps) {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className={cn('mx-auto w-full max-w-6xl px-6 py-8 sm:px-10', className)}>
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            {subtitle ? (
              <div className="text-muted-foreground mt-2 text-base leading-relaxed">
                {subtitle}
              </div>
            ) : null}
            {headerExtra ? <div className="mt-4">{headerExtra}</div> : null}
          </div>
          {aside ? (
            <div className="w-full shrink-0 lg:w-[min(100%,320px)]">{aside}</div>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  )
}
