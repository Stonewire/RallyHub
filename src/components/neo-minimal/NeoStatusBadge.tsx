import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type NeoStatusBadgeTone =
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'active'
  | 'demo'
  | 'ready'
  | 'draft'
  | 'archived'
  | 'paid'
  | 'unpaid'
  | 'demo-event'

type NeoStatusBadgeProps = {
  tone: NeoStatusBadgeTone
  children: ReactNode
  className?: string
}

export function NeoStatusBadge({ tone, children, className }: NeoStatusBadgeProps) {
  return (
    <span
      className={cn(
        'neo-status-badge inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        `neo-status-badge--${tone}`,
        className,
      )}
    >
      {children}
    </span>
  )
}
