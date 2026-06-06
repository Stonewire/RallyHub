import { Slot } from 'radix-ui'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type NeoButtonVariant = 'accent' | 'surface' | 'ghost'
type NeoButtonSize = 'sm' | 'md' | 'lg'

type NeoButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: NeoButtonVariant
  size?: NeoButtonSize
  asChild?: boolean
  children: ReactNode
}

const variantClass: Record<NeoButtonVariant, string> = {
  accent: 'neo-btn-accent',
  surface: 'neo-btn-surface',
  ghost: 'neo-btn-ghost',
}

const sizeClass: Record<NeoButtonSize, string> = {
  sm: 'neo-btn-sm',
  md: 'neo-btn-md',
  lg: 'neo-btn-lg',
}

export function NeoButton({
  variant = 'surface',
  size = 'md',
  asChild = false,
  className,
  children,
  ...props
}: NeoButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      className={cn('neo-btn', variantClass[variant], sizeClass[size], className)}
      {...props}
    >
      {children}
    </Comp>
  )
}
