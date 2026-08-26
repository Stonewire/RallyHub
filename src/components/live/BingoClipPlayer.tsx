import { i18n } from '@/lib/i18n'
import { Pause, Play } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { shouldTriggerBingoLockAndReveal } from '@/lib/bingo-playback'

type BingoClipPlayerProps = {
  src: string
  nextSrc?: string
  playKey: string
  className?: string
  autoPlay?: boolean
  crossfadeSeconds?: number
  /** Fired once ~1s before crossfade out (selections lock + reveal). */
  onLockAndReveal?: () => void
  /** Fired as soon as the next deck starts; advance round only — do not crossfade again. */
  onAutoAdvance?: () => void
  onPlaybackError?: (message: string) => void
}

export type BingoClipPlayerHandle = {
  crossfadeTo: (nextSrc: string, ms?: number) => Promise<boolean>
  playFromUserGesture: (src: string) => Promise<boolean>
  primeAudioContext: () => Promise<void>
  /**
   * Call synchronously inside a user gesture. Plays a silent clip on any deck
   * that has no real source yet, so a later programmatic play() (issued after
   * awaited network work such as run activation) is not blocked by autoplay
   * policy. Decks that already carry a real clip are left untouched.
   */
  unlockFromUserGesture: () => void
  isMounted: () => boolean
  pause: () => void
}

// Tiny valid silent WAV (8 samples of 8-bit silence). Used only to unlock a
// bare deck inside a user gesture; a real clip replaces it immediately after.
const SILENT_UNLOCK_SRC =
  'data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgA=='

async function probeUrl(url: string): Promise<void> {
  try {
    await fetch(url, { method: 'HEAD' })
  } catch {
    // ignore probe failures
  }
}

function clipClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
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
    const { t } = useTranslation('live')
    const audioARef = useRef<HTMLAudioElement>(null)
    const audioBRef = useRef<HTMLAudioElement>(null)
    const activeRef = useRef<'a' | 'b'>('a')
    const onAutoAdvanceRef = useRef(onAutoAdvance)
    const onLockAndRevealRef = useRef(onLockAndReveal)
    const autoFadeTriggeredRef = useRef(false)
    const lockRevealTriggeredRef = useRef(false)
    const crossfadeInProgressRef = useRef(false)
    const [activeDeck, setActiveDeck] = useState<'a' | 'b'>('a')
    const [playing, setPlaying] = useState(false)
    const [position, setPosition] = useState(0)
    const [duration, setDuration] = useState(0)
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
        // The i18n singleton, not the hook's `t`: keeping playElement free of
        // reactive closure keeps the autoPlay effect's deps stable, so a
        // re-render never restarts the clip mid-round.
        const message =
          err instanceof Error ? err.message : i18n.t('live:player.audioPlaybackBlocked')
        console.error(`Bingo audio playElement(${label}) failed`, err)
        onPlaybackErrorRef.current?.(message)
        return false
      }
    }

    async function primeAudioContext(): Promise<void> {}

    function unlockDeckFromUserGesture(el: HTMLAudioElement | null) {
      if (!el) return
      // A deck that already has a real clip either plays inside this gesture or
      // has played before, so only a bare deck needs the silent unlock.
      if (el.src && el.src !== SILENT_UNLOCK_SRC) return
      try {
        el.src = SILENT_UNLOCK_SRC
        el.muted = true
        const cleanup = () => {
          // A real clip may have taken the deck over while the silent play
          // settled: leave it alone in that case.
          if (el.src !== SILENT_UNLOCK_SRC) return
          try {
            el.pause()
          } catch {
            // pausing is best-effort
          }
          el.muted = false
        }
        const p = el.play()
        if (p && typeof p.then === 'function') p.then(cleanup).catch(cleanup)
      } catch {
        // Unlock is best-effort: the in-gesture play path still works without it.
      }
    }

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

      // The next song is already playing at this point. Finish the volume fade in
      // the background so round advancement and participant unlocking do not wait
      // for four seconds of purely local audio work.
      void (async () => {
        const steps = Math.max(8, Math.floor(ms / 100))
        const stepMs = ms / steps
        try {
          for (let i = 1; i <= steps; i++) {
            const ratio = i / steps
            from.volume = Math.max(0, 1 - ratio)
            to.volume = Math.min(1, ratio)
            await sleep(stepMs)
          }
          from.pause()
          from.volume = 1
          from.currentTime = 0
          activeRef.current = activeRef.current === 'a' ? 'b' : 'a'
          setActiveDeck(activeRef.current)
          autoFadeTriggeredRef.current = false
          lockRevealTriggeredRef.current = false
        } finally {
          crossfadeInProgressRef.current = false
        }
      })()
      return true
    }

    useImperativeHandle(ref, () => ({
      crossfadeTo,
      playFromUserGesture,
      primeAudioContext,
      unlockFromUserGesture: () => {
        unlockDeckFromUserGesture(audioARef.current)
        unlockDeckFromUserGesture(audioBRef.current)
      },
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
        // Advancing event_state changes playKey while the old deck is still
        // fading. Ignore those old-deck timeupdate events or they can lock the
        // freshly opened round again.
        if (crossfadeInProgressRef.current) return
        // The 1ms silent unlock clip is not room audio: a stray timeupdate
        // from it must never trigger a lock/reveal or a crossfade (its
        // remaining time is always inside both trigger windows).
        if (cur.src === SILENT_UNLOCK_SRC) return
        if (!cur.duration || Number.isNaN(cur.duration)) return
        const remaining = cur.duration - cur.currentTime

        if (
          onLockAndRevealRef.current &&
          !lockRevealTriggeredRef.current &&
          shouldTriggerBingoLockAndReveal(remaining, revealLeadSeconds)
        ) {
          lockRevealTriggeredRef.current = true
          onLockAndRevealRef.current()
        }

        if (autoFadeTriggeredRef.current) return
        if (!nextSrc) return
        if (remaining <= crossfadeSeconds && remaining > 0) {
          autoFadeTriggeredRef.current = true
          void crossfadeTo(nextSrc, Math.max(1200, Math.floor(remaining * 1000))).then((ok) => {
            if (ok) onAutoAdvanceRef.current?.()
          })
        }
      }
      // The transport reads whichever deck is live, so a crossfade hands the
      // readout over without it resetting to zero.
      const sync = () => {
        setPosition(cur.currentTime)
        setDuration(Number.isFinite(cur.duration) ? cur.duration : 0)
        setPlaying(!cur.paused)
      }
      cur.addEventListener('timeupdate', handleTime)
      cur.addEventListener('timeupdate', sync)
      cur.addEventListener('durationchange', sync)
      cur.addEventListener('play', sync)
      cur.addEventListener('pause', sync)
      sync()
      return () => {
        cur.removeEventListener('timeupdate', handleTime)
        cur.removeEventListener('timeupdate', sync)
        cur.removeEventListener('durationchange', sync)
        cur.removeEventListener('play', sync)
        cur.removeEventListener('pause', sync)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- crossfadeTo isn't memoized (recreated every render); adding it would re-attach the timeupdate listener every render instead of only when the track/deck actually changes. Verified live this session.
    }, [nextSrc, crossfadeSeconds, playKey, activeDeck])

    const progress = duration > 0 ? (position / duration) * 100 : 0

    function toggle() {
      const el = currentAudio()
      if (!el) return
      if (el.paused) void playElement(el, 'toggle')
      else el.pause()
    }

    function seekTo(seconds: number) {
      const el = currentAudio()
      if (!el || !Number.isFinite(el.duration)) return
      el.currentTime = Math.min(Math.max(0, seconds), el.duration)
      setPosition(el.currentTime)
    }

    return (
      <div className={className ?? 'w-full'} data-bingo-player="true">
        {/* Our own transport rather than the browser's pill. No volume slider:
            the room's speakers are not controlled from this page, and the only
            things the facilitator does here are play, pause and scrub. */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? t('player.pause') : t('player.play')}
            className="bg-nm-yellow flex size-11 shrink-0 items-center justify-center rounded-full text-black transition-[filter] hover:brightness-105"
          >
            {playing ? (
              <Pause className="size-5 fill-current" />
            ) : (
              <Play className="ml-0.5 size-5 fill-current" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(duration))}
              value={Math.floor(position)}
              onChange={(e) => seekTo(Number(e.target.value))}
              aria-label={t('player.clipPosition')}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
              style={{
                background: `linear-gradient(to right, var(--nm-yellow) ${progress}%, var(--nm-bg-inset) ${progress}%)`,
              }}
            />
            <div className="text-muted-foreground mt-1 flex justify-between text-[11px] font-semibold tabular-nums">
              <span>{clipClock(position)}</span>
              <span>{clipClock(duration)}</span>
            </div>
          </div>
        </div>
        <audio ref={audioARef} preload="auto" playsInline className="hidden" />
        <audio ref={audioBRef} preload="auto" playsInline className="hidden" />
      </div>
    )
  },
)
