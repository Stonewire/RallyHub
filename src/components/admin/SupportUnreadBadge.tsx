import { cn } from '@/lib/utils'

type SupportUnreadBadgeProps = {
  count: number
  className?: string
}

export function SupportUnreadBadge({ count, className }: SupportUnreadBadgeProps) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white tabular-nums',
        className,
      )}
      aria-label={`${count} unread support ticket${count === 1 ? '' : 's'}`}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}
