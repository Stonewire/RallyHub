import { useEffect, useRef } from 'react'

type BingoClipPlayerProps = {
  src: string
  playKey: string
  className?: string
}

/** Plays a bingo clip; re-mounts when playKey changes (next track). */
export function BingoClipPlayer({ src, playKey, className }: BingoClipPlayerProps) {
  const ref = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !src) return
    el.load()
    void el.play().catch(() => {})
  }, [src, playKey])

  if (!src) return null

  return <audio ref={ref} key={playKey} src={src} controls className={className ?? 'w-full'} />
}
