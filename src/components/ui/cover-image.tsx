import { ImageIcon } from 'lucide-react'

import { resolveAssetUrl } from '@/lib/images'
import { cn } from '@/lib/utils'

export function CoverImage({
  src,
  alt = '',
  className,
}: {
  src: string | null | undefined
  alt?: string
  className?: string
}) {
  const resolved = resolveAssetUrl(src)

  if (!resolved) {
    return (
      <div
        className={cn(
          'bg-muted/40 text-muted-foreground flex items-center justify-center',
          className,
        )}
      >
        <ImageIcon className="size-10 opacity-40" />
      </div>
    )
  }

  return (
    <img
      src={resolved}
      alt={alt}
      className={cn('object-cover', className)}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.display = 'none'
      }}
    />
  )
}
