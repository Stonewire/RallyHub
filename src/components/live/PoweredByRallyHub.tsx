import { cn } from '@/lib/utils'

type Props = {
  hidden?: boolean
  position?: 'bottom-right' | 'bottom-center'
  className?: string
  theme?: 'dark' | 'light'
}

export function PoweredByRallyHub({ hidden, position = 'bottom-right', className, theme = 'dark' }: Props) {
  if (hidden) return null

  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-3 z-40 select-none',
        position === 'bottom-right' ? 'right-4' : 'left-1/2 -translate-x-1/2',
        className,
      )}
    >
      <img
        src={theme === 'light' ? '/powered-by-rallyhub-light.svg' : '/powered-by-rallyhub-dark.svg'}
        alt="Powered by RallyHub"
        className="h-6 w-auto"
      />
    </div>
  )
}
