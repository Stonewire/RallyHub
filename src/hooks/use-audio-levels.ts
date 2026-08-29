import { useEffect, useRef, useState } from 'react'

/**
 * Live frequency levels for the song the room is hearing, for the display's
 * bingo visualizer (R2.4).
 *
 * The audible clip plays on the facilitator's device, so the display cannot
 * analyse it directly. It loads the same clip itself and analyses that,
 * started from the same moment the round goes to 'playing', which is close
 * enough for bars that dance to the music.
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
 * back permanently for the session, and the caller keeps its seeded bars.
 */

const SILENT_GRACE_MS = 1500

export function useAudioLevels(clipUrl: string | null, playing: boolean, bins: number) {
  const [levels, setLevels] = useState<number[] | null>(null)
  const failedRef = useRef(false)

  useEffect(() => {
    if (!clipUrl || !playing || failedRef.current) {
      setLevels(null)
      return
    }
    if (typeof window === 'undefined') return
    const AudioCtx = window.AudioContext ?? (window as unknown as {
      webkitAudioContext?: typeof AudioContext
    }).webkitAudioContext
    if (!AudioCtx) {
      failedRef.current = true
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
      failedRef.current = true
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
      const startedAt = performance.now()
      let sawSound = false

      const tick = () => {
        if (cancelled) return
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
        if (!sawSound && performance.now() - startedAt > SILENT_GRACE_MS) {
          // Playing but silent: tainted media, or a browser that refuses to
          // hand over the samples. Fall back for the rest of the session.
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
  }, [clipUrl, playing, bins])

  return levels
}
