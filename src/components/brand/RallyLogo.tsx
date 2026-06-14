import type { ImgHTMLAttributes } from 'react'

import {
  getRallyhubBrandMarkUrl,
  type RallyBrandMark,
} from '@/constants/brand'
import { cn } from '@/lib/utils'

type RallyLogoProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** `full` wordmark (default) or square `profile` mark with background. */
  mark?: RallyBrandMark
}

export function RallyLogo({
  mark = 'full',
  className,
  alt = 'RallyHub',
  ...props
}: RallyLogoProps) {
  return (
    <img
      src={getRallyhubBrandMarkUrl(mark)}
      alt={alt}
      decoding="async"
      className={cn('block h-auto w-full max-w-none object-contain', className)}
      {...props}
    />
  )
}

/** Admin sidebar: full wordmark expanded, square profile mark when collapsed. */
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
        className="group-data-[collapsible=icon]/sidebar:hidden max-h-[52px] w-full max-w-[200px] object-contain"
        {...props}
      />
      <RallyLogo
        mark="profile"
        alt={alt}
        className="hidden size-8 shrink-0 rounded-md object-cover group-data-[collapsible=icon]/sidebar:block"
        {...props}
      />
    </span>
  )
}
