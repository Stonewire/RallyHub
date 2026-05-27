import type { ComponentProps } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const RH_YELLOW = '#FFCB03'
const RH_TEXT = '#3E3D3E'

/** RallyHub-branded yellow control for facilitator panels only. */
export function FacilitatorButton({
  className,
  variant,
  ...props
}: ComponentProps<typeof Button>) {
  const isOutline = variant === 'outline' || variant === 'ghost'
  return (
    <Button
      variant={variant ?? 'default'}
      className={cn(
        'font-semibold shadow-sm',
        isOutline
          ? 'border-[#FFCB03]/60 bg-transparent text-[#3E3D3E] hover:bg-[#FFCB03]/15'
          : 'border-[#FFCB03]/80 bg-[#FFCB03] text-[#3E3D3E] hover:bg-[#FFCB03]/90',
        className,
      )}
      style={
        !isOutline && variant !== 'destructive'
          ? { backgroundColor: RH_YELLOW, color: RH_TEXT, borderColor: `${RH_YELLOW}cc` }
          : undefined
      }
      {...props}
    />
  )
}

export function FacilitatorButtonLarge(props: ComponentProps<typeof FacilitatorButton>) {
  return <FacilitatorButton className="h-11 px-5 text-base" {...props} />
}
