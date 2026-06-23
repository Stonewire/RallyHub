import { useState } from 'react'

import { PlaceholderImage } from '@/components/marketing/PlaceholderImage'
import { cn } from '@/lib/utils'

type MarketingImageProps = {
  /** Public path, e.g. /marketing/hero.png. Falls back to the placeholder if missing. */
  src: string
  label: string
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
 * Renders a real marketing image; until the file is uploaded to public/, it
 * gracefully shows the labelled placeholder instead of a broken image. Drop the
 * file at `src` and it appears automatically — no code change needed.
 */
export function MarketingImage({ src, label, alt, aspect = 'video', className }: MarketingImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <PlaceholderImage label={label} alt={alt} aspect={aspect} className={className} />
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('neo-card w-full overflow-hidden object-cover', aspectClass[aspect], className)}
    />
  )
}
