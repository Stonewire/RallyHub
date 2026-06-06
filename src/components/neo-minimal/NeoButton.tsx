import { Slot } from 'radix-ui'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** primary = charcoal main action · accent = sparing yellow hero CTA */
export type NeoButtonVariant = 'primary' | 'accent' | 'surface' | 'ghost' | 'destructive'
export type NeoButtonSize = 'sm' | 'md' | 'lg'

type NeoButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: NeoButtonVariant
  size?: NeoButtonSize
  asChild?: boolean
  children: ReactNode
}

const variantClass: Record<NeoButtonVariant, string> = {
  primary: 'neo-btn-primary',
  accent: 'neo-btn-accent',
  surface: 'neo-btn-surface',
  ghost: 'neo-btn-ghost',
  destructive: 'neo-btn-destructive',
}

const sizeClass: Record<NeoButtonSize, string> = {
  sm: 'neo-btn-sm',
  md: 'neo-btn-md',
  lg: 'neo-btn-lg',
}

export function NeoButton({
  variant = 'primary',
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
