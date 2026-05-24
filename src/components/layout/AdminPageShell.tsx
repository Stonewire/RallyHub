import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type AdminPageShellProps = {
  title: string
  subtitle?: ReactNode
  children?: ReactNode
  actions?: ReactNode
  /** Extra margin below hero when omitting subtitle */
  className?: string
}

/** Centered responsive content column for admin pages. */
export function AdminPageShell({
  title,
  subtitle,
  children,
  actions,
  className,
}: AdminPageShellProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-1 justify-center pb-16',
        subtitle == null ? 'pt-4' : 'pt-2',
      )}
    >
      <div
        className={cn('w-full max-w-6xl px-6 sm:px-10 lg:px-14', className)}
      >
        <div className="mb-10 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-[2rem]">
              {title}
            </h1>
            {subtitle ? (
              <div className="text-muted-foreground mt-3 max-w-2xl text-base font-normal leading-relaxed">
                {subtitle}
              </div>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  )
}
