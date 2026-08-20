import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/version'

type Props = {
  hidden?: boolean
  position?: 'bottom-right' | 'bottom-center'
  className?: string
  theme?: 'dark' | 'light'
}

export function PoweredByRallyHub({
  hidden,
  position = 'bottom-right',
  className,
  theme = 'dark',
}: Props) {
  const { t } = useTranslation('live')
  if (hidden) return null

  return (
    <>
      <div
        className={cn(
          'pointer-events-none fixed z-40 select-none',
          // Centred: sits on the centre line of the 48px round buttons either
          // side of it, rather than below them.
          position === 'bottom-right'
            ? 'right-4 bottom-3'
            : 'bottom-[max(1.75rem,calc(env(safe-area-inset-bottom)+1.25rem))] left-1/2 -translate-x-1/2',
          className,
        )}
      >
        <img
          src={
            theme === 'light'
              ? '/powered-by-rallyhub-light.svg?v=4'
              : '/powered-by-rallyhub-dark.svg?v=4'
          }
          alt={t('poweredBy.alt')}
          className="h-6 w-auto"
        />
      </div>
      {/* Build stamp, top left and out of the way: it exists so anyone can read
          the RUNNING version off a device, which is how a stale WebView cache
          (Hermit) gets caught in seconds. */}
      <span
        className={cn(
          'pointer-events-none fixed top-1 left-2 z-40 text-[9px] leading-none select-none',
          theme === 'light' ? 'text-black/35' : 'text-white/35',
        )}
      >
        {APP_VERSION}
      </span>
    </>
  )
}
