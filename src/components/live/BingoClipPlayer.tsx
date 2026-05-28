import { useEffect, useRef } from 'react'

type BingoClipPlayerProps = {
  src: string
  playKey: string
  className?: string
  /** When true, auto-play on mount/key change. */
  autoPlay?: boolean
  onEnded?: () => void
}

export function BingoClipPlayer({
  src,
  playKey,
  className,
  autoPlay = true,
  onEnded,
}: BingoClipPlayerProps) {
  const ref = useRef<HTMLAudioElement>(null)
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  useEffect(() => {
    const el = ref.current
    if (!el || !src) return
    const handleEnded = () => onEndedRef.current?.()
    el.addEventListener('ended', handleEnded)
    el.load()
    if (autoPlay) void el.play().catch(() => {})
    return () => el.removeEventListener('ended', handleEnded)
  }, [src, playKey, autoPlay])

  if (!src) return null

  return (
    <audio
      ref={ref}
      key={playKey}
      src={src}
      controls
      className={className ?? 'w-full'}
      preload="auto"
    />
  )
}
