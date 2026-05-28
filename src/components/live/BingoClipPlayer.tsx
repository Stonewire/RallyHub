import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

type BingoClipPlayerProps = {
  src: string
  nextSrc?: string
  playKey: string
  className?: string
  autoPlay?: boolean
  crossfadeSeconds?: number
  onAutoAdvance?: () => void
}

export type BingoClipPlayerHandle = {
  crossfadeTo: (nextSrc: string, ms?: number) => Promise<void>
}

export const BingoClipPlayer = forwardRef<BingoClipPlayerHandle, BingoClipPlayerProps>(function BingoClipPlayer({
  src,
  nextSrc,
  playKey,
  className,
  autoPlay = true,
  crossfadeSeconds = 4,
  onAutoAdvance,
}: BingoClipPlayerProps, ref) {
  const audioARef = useRef<HTMLAudioElement>(null)
  const audioBRef = useRef<HTMLAudioElement>(null)
  const activeRef = useRef<'a' | 'b'>('a')
  const onAutoAdvanceRef = useRef(onAutoAdvance)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const gainARef = useRef<GainNode | null>(null)
  const gainBRef = useRef<GainNode | null>(null)
  const sourceARef = useRef<MediaElementAudioSourceNode | null>(null)
  const sourceBRef = useRef<MediaElementAudioSourceNode | null>(null)
  const autoFadeTriggeredRef = useRef(false)
  onAutoAdvanceRef.current = onAutoAdvance

  async function ensureGraph(): Promise<boolean> {
    const elA = audioARef.current
    const elB = audioBRef.current
    if (!elA || !elB) return false
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    const ctx = audioCtxRef.current
    if (!gainARef.current) {
      gainARef.current = ctx.createGain()
      gainARef.current.connect(ctx.destination)
    }
    if (!gainBRef.current) {
      gainBRef.current = ctx.createGain()
      gainBRef.current.connect(ctx.destination)
    }
    if (!sourceARef.current) {
      sourceARef.current = ctx.createMediaElementSource(elA)
      sourceARef.current.connect(gainARef.current)
    }
    if (!sourceBRef.current) {
      sourceBRef.current = ctx.createMediaElementSource(elB)
      sourceBRef.current.connect(gainBRef.current)
    }
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {})
    return true
  }

  async function rampGain(gain: GainNode | null, target: number, ms: number) {
    if (!gain) return
    await ensureGraph()
    const ctx = audioCtxRef.current
    if (!ctx) return
    const now = ctx.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(Math.max(0, gain.gain.value), now)
    if (ms <= 0) {
      gain.gain.setValueAtTime(Math.max(0, target), now)
      return
    }
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, target), now + ms / 1000)
  }

  function currentAudio() {
    return activeRef.current === 'a' ? audioARef.current : audioBRef.current
  }
  function standbyAudio() {
    return activeRef.current === 'a' ? audioBRef.current : audioARef.current
  }
  function currentGain() {
    return activeRef.current === 'a' ? gainARef.current : gainBRef.current
  }
  function standbyGain() {
    return activeRef.current === 'a' ? gainBRef.current : gainARef.current
  }

  async function crossfadeTo(url: string, ms = 4000): Promise<void> {
    if (!url) return
    const ok = await ensureGraph()
    if (!ok) return
    const from = currentAudio()
    const to = standbyAudio()
    const fromGain = currentGain()
    const toGain = standbyGain()
    if (!from || !to || !fromGain || !toGain) return
    to.src = url
    to.currentTime = 0
    to.load()
    await rampGain(toGain, 0.0001, 0)
    await to.play().catch(() => {})
    await Promise.all([rampGain(fromGain, 0.0001, ms), rampGain(toGain, 1, ms)])
    window.setTimeout(() => {
      from.pause()
      from.currentTime = 0
      activeRef.current = activeRef.current === 'a' ? 'b' : 'a'
      autoFadeTriggeredRef.current = false
    }, ms)
  }

  useImperativeHandle(ref, () => ({
    crossfadeTo,
  }))

  useEffect(() => {
    const init = async () => {
      const ok = await ensureGraph()
      if (!ok) return
      const cur = currentAudio()
      const curGain = currentGain()
      const sbGain = standbyGain()
      if (!cur || !curGain || !sbGain) return
      cur.src = src
      cur.load()
      await rampGain(curGain, 1, 0)
      await rampGain(sbGain, 0.0001, 0)
      autoFadeTriggeredRef.current = false
      if (autoPlay) await cur.play().catch(() => {})
    }
    void init()
  }, [src, playKey, autoPlay])

  useEffect(() => {
    const cur = currentAudio()
    if (!cur) return
    const handleTime = () => {
      if (autoFadeTriggeredRef.current) return
      if (!nextSrc) return
      if (!cur.duration || Number.isNaN(cur.duration)) return
      const remaining = cur.duration - cur.currentTime
      if (remaining <= crossfadeSeconds && remaining > 0) {
        autoFadeTriggeredRef.current = true
        void crossfadeTo(nextSrc, Math.max(1200, Math.floor(remaining * 1000)))
        window.setTimeout(() => onAutoAdvanceRef.current?.(), 200)
      }
    }
    cur.addEventListener('timeupdate', handleTime)
    return () => {
      cur.removeEventListener('timeupdate', handleTime)
    }
  }, [nextSrc, crossfadeSeconds, playKey, src])

  if (!src) return null

  return (
    <div className={className ?? 'w-full'}>
      <audio ref={audioARef} controls preload="auto" className="w-full" />
      <audio ref={audioBRef} preload="auto" className="hidden" />
    </div>
  )
})
