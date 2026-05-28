import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

type BingoClipPlayerProps = {
  src: string
  playKey: string
  className?: string
  /** When true, auto-play on mount/key change. */
  autoPlay?: boolean
  onEnded?: () => void
  autoAdvanceEnabled?: boolean
  autoFadeSeconds?: number
  onAutoAdvance?: () => void
}

export type BingoClipPlayerHandle = {
  fadeOutAndStop: (ms?: number) => Promise<void>
  runRevealReplay: (opts?: { fadeMs?: number; onDone?: () => void }) => Promise<void>
}

export const BingoClipPlayer = forwardRef<BingoClipPlayerHandle, BingoClipPlayerProps>(function BingoClipPlayer({
  src,
  playKey,
  className,
  autoPlay = true,
  onEnded,
  autoAdvanceEnabled = true,
  autoFadeSeconds = 3,
  onAutoAdvance,
}: BingoClipPlayerProps, ref) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const onEndedRef = useRef(onEnded)
  const onAutoAdvanceRef = useRef(onAutoAdvance)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const autoFadeTriggeredRef = useRef(false)
  onEndedRef.current = onEnded
  onAutoAdvanceRef.current = onAutoAdvance

  async function ensureGraph(el: HTMLAudioElement): Promise<GainNode | null> {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    const ctx = audioCtxRef.current
    if (!gainRef.current) {
      gainRef.current = ctx.createGain()
      gainRef.current.connect(ctx.destination)
    }
    if (!sourceRef.current) {
      sourceRef.current = ctx.createMediaElementSource(el)
      sourceRef.current.connect(gainRef.current)
    }
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {})
    return gainRef.current
  }

  async function fadeGain(target: number, ms: number) {
    const el = audioRef.current
    if (!el) return
    const gain = await ensureGraph(el)
    const ctx = audioCtxRef.current
    if (!gain || !ctx) return
    const now = ctx.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now)
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, target), now + ms / 1000)
  }

  async function fadeOutAndStop(ms = 2500): Promise<void> {
    const el = audioRef.current
    if (!el) return
    await fadeGain(0.0001, ms)
    await new Promise((resolve) => window.setTimeout(resolve, ms))
    el.pause()
  }

  async function runRevealReplay(opts?: { fadeMs?: number; onDone?: () => void }) {
    const el = audioRef.current
    if (!el) return
    const fadeMs = opts?.fadeMs ?? 2500
    await fadeOutAndStop(fadeMs)
    el.currentTime = 0
    await fadeGain(1, fadeMs)
    await el.play().catch(() => {})
    const onTime = () => {
      if (!el.duration || Number.isNaN(el.duration)) return
      if (el.duration - el.currentTime <= 2.8) {
        el.removeEventListener('timeupdate', onTime)
        void fadeGain(0.0001, fadeMs)
      }
    }
    el.addEventListener('timeupdate', onTime)
    const done = () => {
      el.removeEventListener('ended', done)
      opts?.onDone?.()
    }
    el.addEventListener('ended', done)
  }

  useImperativeHandle(ref, () => ({
    fadeOutAndStop,
    runRevealReplay,
  }))

  useEffect(() => {
    const el = audioRef.current
    if (!el || !src) return
    const handleEnded = () => onEndedRef.current?.()
    const handleTime = () => {
      if (!autoAdvanceEnabled || autoFadeTriggeredRef.current) return
      if (!el.duration || Number.isNaN(el.duration)) return
      const remaining = el.duration - el.currentTime
      if (remaining <= autoFadeSeconds && remaining > 0) {
        autoFadeTriggeredRef.current = true
        void fadeGain(0.0001, Math.max(300, Math.floor(remaining * 1000)))
        window.setTimeout(() => {
          onAutoAdvanceRef.current?.()
        }, Math.max(100, Math.floor(remaining * 1000)))
      }
    }
    el.addEventListener('ended', handleEnded)
    el.addEventListener('timeupdate', handleTime)
    el.load()
    autoFadeTriggeredRef.current = false
    if (autoPlay) void el.play().catch(() => {})
    return () => {
      el.removeEventListener('ended', handleEnded)
      el.removeEventListener('timeupdate', handleTime)
    }
  }, [src, playKey, autoPlay, autoAdvanceEnabled, autoFadeSeconds])

  if (!src) return null

  return (
    <audio
      ref={audioRef}
      key={playKey}
      src={src}
      controls
      className={className ?? 'w-full'}
      preload="auto"
    />
  )
})
