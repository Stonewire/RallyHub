import type { ComponentProps } from 'react'

import { Button } from '@/components/ui/button'
import { textOnAccent } from '@/lib/live-event'
import { cn } from '@/lib/utils'

type LiveAccentButtonProps = ComponentProps<typeof Button> & {
  accentColor: string
}

/** Accent-styled button using the event brand color (not RallyHub yellow). */
export function LiveAccentButton({
  accentColor,
  className,
  style,
  ...props
}: LiveAccentButtonProps) {
  const fg = textOnAccent(accentColor)
  return (
    <Button
      className={cn('border-transparent font-semibold shadow-sm hover:brightness-95', className)}
      style={{
        backgroundColor: accentColor,
        color: fg,
        borderColor: `${accentColor}cc`,
        ...style,
      }}
      {...props}
    />
  )
}
