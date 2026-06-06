import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type NeoPageShellProps = {
  title: string
  subtitle?: ReactNode
  children?: ReactNode
  actions?: ReactNode
  className?: string
}

/** Neo-minimal page frame — pilot replacement for AdminPageShell on selected screens. */
export function NeoPageShell({
  title,
  subtitle,
  children,
  actions,
  className,
}: NeoPageShellProps) {
  return (
    <div className={cn('flex w-full flex-1 justify-center pb-16 pt-2', className)}>
      <div className="w-full max-w-6xl px-6 sm:px-10 lg:px-14">
        <div className="mb-10 flex flex-col gap-5 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="neo-page-title">{title}</h1>
            {subtitle ? <p className="neo-page-subtitle">{subtitle}</p> : null}
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
