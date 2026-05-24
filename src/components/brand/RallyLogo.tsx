import type { ImgHTMLAttributes } from 'react'

import { getRallyhubFullLogoUrl } from '@/constants/brand'
import { cn } from '@/lib/utils'

export function RallyLogo({
  className,
  alt = 'RallyHub',
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={getRallyhubFullLogoUrl()}
      alt={alt}
      decoding="async"
      className={cn('block h-auto w-full max-w-none object-contain', className)}
      {...props}
    />
  )
}
