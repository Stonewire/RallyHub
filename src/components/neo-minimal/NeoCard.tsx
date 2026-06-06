import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type NeoCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  /** Adds hover lift + pressed depth (for clickable tiles). */
  interactive?: boolean
}

export function NeoCard({
  children,
  className,
  interactive = false,
  ...props
}: NeoCardProps) {
  return (
    <div
      className={cn('neo-card', interactive && 'neo-card-interactive', className)}
      {...props}
    >
      {children}
    </div>
  )
}
