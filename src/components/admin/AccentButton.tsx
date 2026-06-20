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
        'border-[#FFC107]/80 bg-[#FFC107] font-semibold text-[#3E3D3E] shadow-sm hover:bg-[#FFC107]/90',
        className,
      )}
      {...props}
    />
  )
}
