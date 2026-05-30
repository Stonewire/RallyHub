import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

const LOG = '[BingoClipPlayer]'

type BingoClipPlayerProps = {
  src: string
  nextSrc?: string
  playKey: string
  className?: string
  autoPlay?: boolean
  crossfadeSeconds?: number
  onAutoAdvance?: () => void
  onPlaybackError?: (message: string) => void
}

export type BingoClipPlayerHandle = {
  crossfadeTo: (nextSrc: string, ms?: number) => Promise<boolean>
  playFromUserGesture: (src: string) => Promise<boolean>
  primeAudioContext: () => Promise<void>
  isMounted: () => boolean
}

async function probeUrl(url: string): Promise<void> {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    console.log(`${LOG} URL probe`, { url, status: res.status, ok: res.ok })
  } catch (err) {
    console.warn(`${LOG} URL probe failed`, { url, err })
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

export const BingoClipPlayer = forwardRef<BingoClipPlayerHandle, BingoClipPlayerProps>(
  function BingoClipPlayer(
    {
      src,
      nextSrc,
      playKey,
      className,
      autoPlay = true,
      crossfadeSeconds = 4,
      onAutoAdvance,
      onPlaybackError,
    }: BingoClipPlayerProps,
    ref,
  ) {
    const audioARef = useRef<HTMLAudioElement>(null)
    const audioBRef = useRef<HTMLAudioElement>(null)
    const activeRef = useRef<'a' | 'b'>('a')
    const onAutoAdvanceRef = useRef(onAutoAdvance)
    const autoFadeTriggeredRef = useRef(false)
    const [activeDeck, setActiveDeck] = useState<'a' | 'b'>('a')
    const onPlaybackErrorRef = useRef(onPlaybackError)
    onAutoAdvanceRef.current = onAutoAdvance
    onPlaybackErrorRef.current = onPlaybackError

    function currentAudio() {
      return activeRef.current === 'a' ? audioARef.current : audioBRef.current
    }
    function standbyAudio() {
      return activeRef.current === 'a' ? audioBRef.current : audioARef.current
    }

    async function playElement(el: HTMLAudioElement, label: string): Promise<boolean> {
      console.log(`${LOG} playElement(${label})`, {
        src: el.src,
        paused: el.paused,
        readyState: el.readyState,
        volume: el.volume,
      })
      try {
        await el.play()
        console.log(`${LOG} playElement(${label}) succeeded`, {
          paused: el.paused,
          currentTime: el.currentTime,
        })
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Audio playback blocked'
        console.error(`${LOG} playElement(${label}) failed`, err)
        onPlaybackErrorRef.current?.(message)
        return false
      }
    }

    async function primeAudioContext(): Promise<void> {
      console.log(`${LOG} primeAudioContext (native audio — no AudioContext needed)`)
    }

    async function playFromUserGesture(url: string): Promise<boolean> {
      console.log(`${LOG} playFromUserGesture called`, {
        url,
        mountedA: Boolean(audioARef.current),
        mountedB: Boolean(audioBRef.current),
        activeDeck: activeRef.current,
      })
      if (!url?.trim()) {
        console.warn(`${LOG} playFromUserGesture aborted — empty url`)
        return false
      }
      void probeUrl(url)
      const el = currentAudio()
      if (!el) {
        console.error(`${LOG} playFromUserGesture aborted — no active audio element in DOM`)
        return false
      }
      el.volume = 1
      el.muted = false
      if (el.src !== url) {
        el.src = url
        el.load()
      }
      autoFadeTriggeredRef.current = false
      return playElement(el, 'gesture')
    }

    async function crossfadeTo(url: string, ms = 4000): Promise<boolean> {
      console.log(`${LOG} crossfadeTo`, { url, ms })
      if (!url?.trim()) return false
      const from = currentAudio()
      const to = standbyAudio()
      if (!from || !to) return false
      to.volume = 0
      to.muted = false
      to.src = url
      to.currentTime = 0
      to.load()
      const started = await playElement(to, 'crossfade-in')
      if (!started) return false
      const steps = Math.max(8, Math.floor(ms / 100))
      const stepMs = ms / steps
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        from.volume = Math.max(0, 1 - t)
        to.volume = Math.min(1, t)
        await sleep(stepMs)
      }
      from.pause()
      from.volume = 1
      from.currentTime = 0
      activeRef.current = activeRef.current === 'a' ? 'b' : 'a'
      setActiveDeck(activeRef.current)
      autoFadeTriggeredRef.current = false
      console.log(`${LOG} crossfadeTo complete`, { activeDeck: activeRef.current })
      return true
    }

    useImperativeHandle(ref, () => ({
      crossfadeTo,
      playFromUserGesture,
      primeAudioContext,
      isMounted: () => Boolean(audioARef.current && audioBRef.current),
    }))

    useEffect(() => {
      if (!src?.trim() || !autoPlay) return
      const el = currentAudio()
      if (!el) return
      console.log(`${LOG} autoPlay effect`, { src, playKey })
      el.volume = 1
      el.src = src
      el.load()
      autoFadeTriggeredRef.current = false
      void playElement(el, 'autoPlay')
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
          console.log(`${LOG} auto-fade trigger`, { remaining, nextSrc })
          void crossfadeTo(nextSrc, Math.max(1200, Math.floor(remaining * 1000))).then((ok) => {
            if (ok) window.setTimeout(() => onAutoAdvanceRef.current?.(), 200)
          })
        }
      }
      cur.addEventListener('timeupdate', handleTime)
      return () => cur.removeEventListener('timeupdate', handleTime)
    }, [nextSrc, crossfadeSeconds, playKey, activeDeck])

    return (
      <div className={className ?? 'w-full'} data-bingo-player="true">
        <audio
          ref={audioARef}
          controls={activeDeck === 'a'}
          preload="auto"
          playsInline
          className={activeDeck === 'a' ? 'w-full' : 'hidden'}
        />
        <audio
          ref={audioBRef}
          controls={activeDeck === 'b'}
          preload="auto"
          playsInline
          className={activeDeck === 'b' ? 'w-full' : 'hidden'}
        />
      </div>
    )
  },
)
