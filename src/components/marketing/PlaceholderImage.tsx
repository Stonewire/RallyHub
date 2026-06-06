import { ImageIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type PlaceholderImageProps = {
  /** Visible label for designers replacing this slot. */
  label: string
  /** Descriptive alt text for accessibility (placeholder state). */
  alt: string
  aspect?: 'video' | 'square' | 'portrait' | 'wide'
  className?: string
}

const aspectClass = {
  video: 'aspect-video',
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  wide: 'aspect-[21/9]',
} as const

/**
 * Marked placeholder for marketing imagery — replace `src` later with real photos.
 * Slot id is encoded in data-placeholder for easy find-and-replace in the codebase.
 */
export function PlaceholderImage({
  label,
  alt,
  aspect = 'video',
  className,
}: PlaceholderImageProps) {
  const slotId = label.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  return (
    <div
      data-placeholder={slotId}
      role="img"
      aria-label={alt}
      className={cn(
        'neo-card relative flex items-center justify-center overflow-hidden border-dashed',
        aspectClass[aspect],
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden
        style={{
          background:
            'linear-gradient(135deg, var(--nm-bg-muted) 0%, var(--nm-bg-elevated) 45%, color-mix(in srgb, var(--nm-yellow) 18%, var(--nm-bg-surface)) 100%)',
        }}
      />
      <div className="relative flex flex-col items-center gap-2 px-4 text-center">
        <div className="neo-icon-container neo-icon-container-md neo-icon-container-accent">
          <ImageIcon className="size-5" aria-hidden />
        </div>
        <p className="text-muted-foreground max-w-[14rem] text-xs font-medium tracking-wide uppercase">
          Image placeholder
        </p>
        <p className="text-foreground text-sm font-semibold">{label}</p>
      </div>
    </div>
  )
}
