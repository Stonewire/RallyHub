import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

type BingoClipPlayerProps = {
  src: string
  nextSrc?: string
  playKey: string
  className?: string
  autoPlay?: boolean
  crossfadeSeconds?: number
  /** Fired once ~1s before crossfade out (selections lock + reveal). */
  onLockAndReveal?: () => void
  /** Fired after crossfade completes; advance round only — do not crossfade again. */
  onAutoAdvance?: () => void
  onPlaybackError?: (message: string) => void
}

export type BingoClipPlayerHandle = {
  crossfadeTo: (nextSrc: string, ms?: number) => Promise<boolean>
  playFromUserGesture: (src: string) => Promise<boolean>
  primeAudioContext: () => Promise<void>
  isMounted: () => boolean
  pause: () => void
}

async function probeUrl(url: string): Promise<void> {
  try {
    await fetch(url, { method: 'HEAD' })
  } catch {
    // ignore probe failures
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
      onLockAndReveal,
      onAutoAdvance,
      onPlaybackError,
    }: BingoClipPlayerProps,
    ref,
  ) {
    const audioARef = useRef<HTMLAudioElement>(null)
    const audioBRef = useRef<HTMLAudioElement>(null)
    const activeRef = useRef<'a' | 'b'>('a')
    const onAutoAdvanceRef = useRef(onAutoAdvance)
    const onLockAndRevealRef = useRef(onLockAndReveal)
    const autoFadeTriggeredRef = useRef(false)
    const lockRevealTriggeredRef = useRef(false)
    const crossfadeInProgressRef = useRef(false)
    const [activeDeck, setActiveDeck] = useState<'a' | 'b'>('a')
    const onPlaybackErrorRef = useRef(onPlaybackError)
    onAutoAdvanceRef.current = onAutoAdvance
    onLockAndRevealRef.current = onLockAndReveal
    onPlaybackErrorRef.current = onPlaybackError

    function currentAudio() {
      return activeRef.current === 'a' ? audioARef.current : audioBRef.current
    }
    function standbyAudio() {
      return activeRef.current === 'a' ? audioBRef.current : audioARef.current
    }

    async function playElement(el: HTMLAudioElement, label: string): Promise<boolean> {
      try {
        await el.play()
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Audio playback blocked'
        console.error(`Bingo audio playElement(${label}) failed`, err)
        onPlaybackErrorRef.current?.(message)
        return false
      }
    }

    async function primeAudioContext(): Promise<void> {}

    /** Resolve once the element has buffered enough to start, or on timeout. */
    function waitForReady(el: HTMLAudioElement, timeoutMs = 4000): Promise<boolean> {
      if (el.readyState >= 3 /* HAVE_FUTURE_DATA */) return Promise.resolve(true)
      return new Promise((resolve) => {
        let done = false
        const finish = (ok: boolean) => {
          if (done) return
          done = true
          el.removeEventListener('canplay', onReady)
          el.removeEventListener('loadeddata', onReady)
          window.clearTimeout(timer)
          resolve(ok)
        }
        const onReady = () => finish(true)
        el.addEventListener('canplay', onReady, { once: true })
        el.addEventListener('loadeddata', onReady, { once: true })
        const timer = window.setTimeout(() => finish(false), timeoutMs)
      })
    }

    async function playFromUserGesture(url: string): Promise<boolean> {
      if (!url?.trim()) return false
      void probeUrl(url)
      const el = currentAudio()
      if (!el) {
        console.error('Bingo audio playFromUserGesture aborted — no active audio element in DOM')
        return false
      }
      el.volume = 1
      el.muted = false
      // Assigning .src already starts loading. Calling el.load() here aborts the
      // immediate play() below (AbortError), which forced a second Start press.
      if (el.src !== url) {
        el.src = url
      }
      autoFadeTriggeredRef.current = false
      lockRevealTriggeredRef.current = false
      const ok = await playElement(el, 'gesture')
      if (ok) return true
      // Source was just (re)assigned and wasn't ready yet — wait for it to buffer
      // and try once more so a single press reliably starts playback.
      const ready = await waitForReady(el)
      if (!ready) return false
      return playElement(el, 'gesture-retry')
    }

    async function crossfadeTo(url: string, ms = 4000): Promise<boolean> {
      if (!url?.trim()) return false
      if (crossfadeInProgressRef.current) return false
      const from = currentAudio()
      const to = standbyAudio()
      if (!from || !to) return false

      crossfadeInProgressRef.current = true
      to.volume = 0
      to.muted = false

      const sameSrc = to.src === url || to.currentSrc === url
      if (!sameSrc) {
        to.src = url
        to.currentTime = 0
        to.load()
      } else if (to.paused) {
        to.currentTime = 0
      }

      const started = await playElement(to, 'crossfade-in')
      if (!started) {
        crossfadeInProgressRef.current = false
        return false
      }

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
      lockRevealTriggeredRef.current = false
      crossfadeInProgressRef.current = false
      return true
    }

    useImperativeHandle(ref, () => ({
      crossfadeTo,
      playFromUserGesture,
      primeAudioContext,
      isMounted: () => Boolean(audioARef.current && audioBRef.current),
      pause: () => {
        audioARef.current?.pause()
        audioBRef.current?.pause()
      },
    }))

    useEffect(() => {
      autoFadeTriggeredRef.current = false
      lockRevealTriggeredRef.current = false
    }, [playKey])

    useEffect(() => {
      if (!src?.trim() || !autoPlay || crossfadeInProgressRef.current) return
      const el = currentAudio()
      if (!el) return
      el.volume = 1
      el.src = src
      el.load()
      autoFadeTriggeredRef.current = false
      lockRevealTriggeredRef.current = false
      void playElement(el, 'autoPlay')
    }, [src, playKey, autoPlay])

    useEffect(() => {
      const cur = currentAudio()
      if (!cur) return
      const revealLeadSeconds = crossfadeSeconds + 1

      const handleTime = () => {
        if (!cur.duration || Number.isNaN(cur.duration)) return
        const remaining = cur.duration - cur.currentTime

        if (
          onLockAndRevealRef.current &&
          !lockRevealTriggeredRef.current &&
          remaining <= revealLeadSeconds &&
          remaining > crossfadeSeconds
        ) {
          lockRevealTriggeredRef.current = true
          onLockAndRevealRef.current()
        }

        if (autoFadeTriggeredRef.current) return
        if (!nextSrc) return
        if (remaining <= crossfadeSeconds && remaining > 0) {
          autoFadeTriggeredRef.current = true
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
