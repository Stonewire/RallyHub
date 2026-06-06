import type { ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function NeoInput({ className, ...props }: ComponentProps<typeof Input>) {
  return <Input className={cn('neo-field', className)} {...props} />
}

export function NeoLabel({ className, ...props }: ComponentProps<typeof Label>) {
  return <Label className={cn('neo-label', className)} {...props} />
}

export function NeoTextarea({
  className,
  ...props
}: ComponentProps<'textarea'>) {
  return <textarea className={cn('neo-field neo-textarea', className)} {...props} />
}

export function NeoSelect({
  className,
  children,
  ...props
}: ComponentProps<'select'>) {
  return (
    <select className={cn('neo-field neo-select', className)} {...props}>
      {children}
    </select>
  )
}
