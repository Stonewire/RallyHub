import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type CompactListRowProps = {
  children: ReactNode
  actions?: ReactNode
  className?: string
}

/** Minimal list-row shell (settings-list style). */
export function CompactListRow({ children, actions, className }: CompactListRowProps) {
  return (
    <div
      className={cn(
        'border-border/80 bg-card flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0',
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
