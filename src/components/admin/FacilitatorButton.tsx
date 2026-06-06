import type { ComponentProps } from 'react'

import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Facilitator control button — neo-minimal charcoal/surface variants. */
export function FacilitatorButton({
  className,
  variant,
  size,
  ...props
}: ComponentProps<typeof Button>) {
  const neoVariant =
    variant === 'destructive'
      ? 'destructive'
      : variant === 'outline' || variant === 'ghost'
        ? 'surface'
        : 'primary'
  const neoSize =
    size === 'lg' ? 'lg' : size === 'sm' || size === 'icon' || size === 'icon-sm' ? 'sm' : 'md'

  return (
    <NeoButton
      variant={neoVariant}
      size={neoSize}
      className={cn(className)}
      {...(props as ComponentProps<typeof NeoButton>)}
    />
  )
}

export function FacilitatorButtonLarge({
  className,
  ...props
}: ComponentProps<typeof FacilitatorButton>) {
  return (
    <NeoButton
      variant="accent"
      size="lg"
      className={cn('h-11 px-5 text-base', className)}
      {...(props as ComponentProps<typeof NeoButton>)}
    />
  )
}
