import { cn } from '@/lib/utils'

type Props = {
  hidden?: boolean
  position?: 'bottom-right' | 'bottom-center'
  className?: string
}

export function PoweredByRallyHub({ hidden, position = 'bottom-right', className }: Props) {
  if (hidden) return null

  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-3 z-40 select-none',
        position === 'bottom-right' ? 'right-4' : 'left-1/2 -translate-x-1/2',
        className,
      )}
    >
      <span className="rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white/70 backdrop-blur-sm">
        Powered by RallyHub
      </span>
    </div>
  )
}
