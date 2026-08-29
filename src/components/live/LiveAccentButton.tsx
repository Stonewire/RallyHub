import type { ComponentProps } from 'react'

import { Button } from '@/components/ui/button'
import { LIVE_LABEL_WRAP_CLASS, textOnAccent } from '@/lib/live-event'
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
      className={cn(
        'xp-live-btn border-transparent font-semibold shadow-sm hover:brightness-95',
        LIVE_LABEL_WRAP_CLASS,
        className,
      )}
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
