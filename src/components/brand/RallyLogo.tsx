import type { ImgHTMLAttributes } from 'react'

import {
  getRallyhubBrandMarkUrl,
  type RallyBrandMark,
  type RallyBrandTheme,
} from '@/constants/brand'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type RallyLogoProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** `full` wordmark w/ slogan, compact `wordmark`, or square `profile` icon. */
  mark?: RallyBrandMark
  /** Force a colourway. Defaults to the active app theme (charcoal/ivory). */
  theme?: RallyBrandTheme
}

export function RallyLogo({
  mark = 'full',
  theme,
  className,
  alt = 'RallyHub',
  ...props
}: RallyLogoProps) {
  const { resolvedTheme } = useTheme()
  const variant = theme ?? resolvedTheme
  return (
    <img
      src={getRallyhubBrandMarkUrl(mark, variant)}
      alt={alt}
      decoding="async"
      className={cn('block h-auto w-full max-w-none object-contain', className)}
      {...props}
    />
  )
}

/** Admin sidebar: compact wordmark when expanded, square icon when collapsed. */
export function RallySidebarLogo({
  className,
  alt = 'RallyHub',
  ...props
}: Omit<RallyLogoProps, 'mark'>) {
  return (
    <span className={cn('block', className)}>
      <RallyLogo
        mark="full"
        alt={alt}
        className="group-data-[collapsible=icon]:hidden max-h-[56px] w-full max-w-[190px] object-contain"
        {...props}
      />
      <RallyLogo
        mark="profile"
        alt={alt}
        className="hidden size-8 shrink-0 object-contain group-data-[collapsible=icon]:block"
        {...props}
      />
    </span>
  )
}
