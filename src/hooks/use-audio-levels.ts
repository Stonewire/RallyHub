import { useEffect, useRef, useState } from 'react'

import { bingoSyncSeekSeconds, type BingoTrackAnchor } from '@/lib/bingo-playback'

/**
 * Live frequency levels for the song the room is hearing, for the display's
 * bingo visualizer (R2.4).
 *
 * The audible clip plays on the facilitator's device, so the display cannot
 * analyse it directly. It loads the same clip itself and analyses that,
 * following the facilitator's position anchor from event_state so the bars sit
 * on the sound rather than on a guess. The anchor is re-read on a timer, not
 * just at the start, because a start-only offset is the drift for the whole
 * song: a display that missed Realtime and caught the flip on the 4s poll was
 * four seconds behind the room for the entire track.
 *
 * The display must stay SILENT, and the way that is done matters. Muting the
 * element does not work: a muted element feeds silence into the audio graph,
 * so the analyser reads zeros (measured). Routing the element into a
 * MediaElementSource already takes its audio off the speakers, so the element
 * is left unmuted and the analyser is simply never connected to the context
 * destination. Nothing is heard, and the analyser sees the real samples.
 *
 * Every step is best effort: an unsupported browser, a blocked autoplay, a
 * missing CORS header (which taints the media and yields silence) all fall
 * back to the caller's seeded bars. That fallback is scoped to the clip and
 * the retry key that failed, never to the whole mount: one bad track, or one
 * play() the autoplay policy refused before the display's sound gate was
 * tapped, used to kill live analysis for the rest of the game.
 */

const SILENT_GRACE_MS = 1500
const SYNC_CHECK_MS = 1500

export type AudioLevelsOptions = {
  clipUrl: string | null
  /** True while the room is hearing this clip. */
  active: boolean
  bins: number
  /** Track the clip belongs to. An anchor for any other track is not ours. */
  trackId?: string | null
  /** Where the room is in the song, straight off event_state. */
  anchor?: BingoTrackAnchor | null
  /**
   * Re-arms analysis after a failure whenever it changes. The display bumps it
   * when its sound gate is tapped: a play() the autoplay policy refused while
   * the gate was up succeeds once the page has been touched.
   */
  retryKey?: string | number
}

export function useAudioLevels({
  clipUrl,
  active,
  bins,
  trackId = null,
  anchor = null,
  retryKey = '',
}: AudioLevelsOptions): number[] | null {
  const [levels, setLevels] = useState<number[] | null>(null)
  const failedKeyRef = useRef<string | null>(null)
  // Read fresh inside the animation loop rather than depended on, so a new
  // anchor arriving every poll corrects the position instead of tearing the
  // whole audio graph down and starting the clip again.
  const anchorRef = useRef(anchor)
  const trackIdRef = useRef(trackId)

  // Declared before the analyser effect so a fresh anchor is in place by the
  // time that effect (re)starts on the same render.
  useEffect(() => {
    anchorRef.current = anchor
    trackIdRef.current = trackId
  })

  useEffect(() => {
    const attemptKey = `${clipUrl}|${retryKey}`
    if (!clipUrl || !active || failedKeyRef.current === attemptKey) {
      setLevels(null)
      return
    }
    if (typeof window === 'undefined') return
    const AudioCtx = window.AudioContext ?? (window as unknown as {
      webkitAudioContext?: typeof AudioContext
    }).webkitAudioContext
    if (!AudioCtx) {
      failedKeyRef.current = attemptKey
      return
    }

    let cancelled = false
    let frame = 0
    let context: AudioContext | null = null
    const element = new Audio()
    // Set before src: the crossOrigin attribute only affects a load it precedes,
    // and without it the decoded samples are tainted and read as silence.
    element.crossOrigin = 'anonymous'
    element.preload = 'auto'
    element.src = clipUrl

    function giveUp() {
      failedKeyRef.current = attemptKey
      if (!cancelled) setLevels(null)
    }

    try {
      context = new AudioCtx()
      const source = context.createMediaElementSource(element)
      const analyser = context.createAnalyser()
      analyser.fftSize = 128
      analyser.smoothingTimeConstant = 0.75
      // Deliberately NOT connected to context.destination: that is what keeps
      // the display silent while the analyser still receives the audio.
      source.connect(analyser)

      const data = new Uint8Array(analyser.frequencyBinCount)
      let graceUntil = performance.now() + SILENT_GRACE_MS
      let nextSyncAt = 0
      let sawSound = false

      /**
       * Pull the copy back onto the room's position, and follow the room's
       * transport. Nobody hears this element, so a correction costs nothing
       * beyond a re-buffer, which is why it only fires past a tolerance.
       */
      const syncToRoom = () => {
        const roomAnchor = anchorRef.current
        const ourTrack = trackIdRef.current
        const roomPaused = Boolean(
          roomAnchor && roomAnchor.trackId === ourTrack && roomAnchor.paused,
        )
        if (roomPaused) {
          if (!element.paused) element.pause()
          // Silence with a reason: never read a deliberate pause as a failure.
          graceUntil = performance.now() + SILENT_GRACE_MS
        } else if (element.paused && !element.ended) {
          void element.play().catch(() => {})
          // Restarting re-buffers, and the last grace was set while the room
          // was still paused. Without this the first frames after a resume
          // read zeros and giveUp() kills live analysis for the whole mount.
          graceUntil = performance.now() + SILENT_GRACE_MS
        }
        const seconds = bingoSyncSeekSeconds({
          anchor: roomAnchor,
          trackId: ourTrack,
          nowMs: Date.now(),
          durationSeconds: Number.isFinite(element.duration) ? element.duration : null,
          currentSeconds: element.currentTime,
        })
        if (seconds === null) return
        element.currentTime = seconds
        // A seek re-buffers, so the analyser reads zeros for a moment.
        graceUntil = performance.now() + SILENT_GRACE_MS
      }

      const tick = () => {
        if (cancelled) return
        const now = performance.now()
        if (now >= nextSyncAt) {
          nextSyncAt = now + SYNC_CHECK_MS
          syncToRoom()
        }
        if (element.paused || element.ended) {
          // Nothing real to show. Hand the bars back to the seeded animation
          // rather than letting them flatten out on screen.
          setLevels(null)
          frame = requestAnimationFrame(tick)
          return
        }
        analyser.getByteFrequencyData(data)
        let total = 0
        const next: number[] = []
        // Fold the FFT bins down to the bar count, skipping the top of the
        // spectrum where a 30s mp3 clip has almost nothing to show.
        const usable = Math.floor(data.length * 0.7)
        const per = Math.max(1, Math.floor(usable / bins))
        for (let i = 0; i < bins; i++) {
          let sum = 0
          for (let j = 0; j < per; j++) sum += data[i * per + j] ?? 0
          const value = sum / per / 255
          total += value
          next.push(value)
        }
        if (total > 0) sawSound = true
        if (!sawSound && now > graceUntil) {
          // Playing but silent: tainted media, or a browser that refuses to
          // hand over the samples. Fall back for this clip.
          giveUp()
          return
        }
        setLevels(next)
        frame = requestAnimationFrame(tick)
      }

      void context.resume().catch(() => {})
      void element
        .play()
        .then(() => {
          if (cancelled) return
          // Land on the room's position before the first frame, so a display
          // opened mid-song does not spend a second climbing back up to it.
          syncToRoom()
          nextSyncAt = performance.now() + SYNC_CHECK_MS
          frame = requestAnimationFrame(tick)
        })
        .catch(() => giveUp())
    } catch {
      giveUp()
    }

    return () => {
      cancelled = true
      if (frame) cancelAnimationFrame(frame)
      element.pause()
      element.src = ''
      void context?.close().catch(() => {})
    }
  }, [clipUrl, active, bins, retryKey])

  return levels
}
