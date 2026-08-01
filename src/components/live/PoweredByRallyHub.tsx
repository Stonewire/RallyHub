import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/version'

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
        src={
          theme === 'light'
            ? '/powered-by-rallyhub-light.svg?v=4'
            : '/powered-by-rallyhub-dark.svg?v=4'
        }
        alt="Powered by RallyHub"
        className="h-6 w-auto"
      />
      {/* Tiny build stamp: lets anyone read the RUNNING version off a device,
          which is how a stale WebView cache (Hermit) gets caught in seconds. */}
      <span
        className={cn(
          'absolute -bottom-3 right-0 text-[9px] leading-none',
          theme === 'light' ? 'text-black/35' : 'text-white/35',
        )}
      >
        {APP_VERSION}
      </span>
    </div>
  )
}
