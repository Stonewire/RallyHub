import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type NeoIconContainerProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  accent?: boolean
}

export function NeoIconContainer({
  children,
  size = 'md',
  accent = false,
  className,
  ...props
}: NeoIconContainerProps) {
  return (
    <div
      className={cn(
        'neo-icon-container',
        size === 'sm' && 'neo-icon-container-sm',
        size === 'md' && 'neo-icon-container-md',
        size === 'lg' && 'neo-icon-container-lg',
        accent && 'neo-icon-container-accent',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
