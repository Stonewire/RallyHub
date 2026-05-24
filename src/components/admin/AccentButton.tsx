import type { ComponentProps } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function AccentButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        'border-[#FFCB03]/80 bg-[#FFCB03] font-semibold text-[#3E3D3E] shadow-sm hover:bg-[#FFCB03]/90',
        className,
      )}
      {...props}
    />
  )
}
