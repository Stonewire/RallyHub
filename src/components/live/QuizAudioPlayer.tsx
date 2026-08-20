import { Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Bars drawn across the box; enough to read as a waveform, few enough to tap through. */
const BAR_COUNT = 64

/**
 * Deterministic stand-in shape, used until the real peaks are decoded and if
 * decoding is refused (a file served without CORS headers). Seeded from the
 * URL so the same clip always draws the same shape rather than flickering.
 */
function placeholderPeaks(seed: string): number[] {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0
    const wave = 0.55 + 0.45 * Math.sin((i / BAR_COUNT) * Math.PI * 3)
    return Math.max(0.15, Math.min(1, wave * (0.55 + (h % 1000) / 2000)))
  })
}

/** Peak amplitude per bar, from the decoded file. */
async function decodePeaks(url: string): Promise<number[] | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const bytes = await response.arrayBuffer()
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return null
    const buffer = await new AudioCtor().decodeAudioData(bytes)
    const channel = buffer.getChannelData(0)
    const per = Math.floor(channel.length / BAR_COUNT) || 1
    const peaks: number[] = []
    let loudest = 0
    for (let i = 0; i < BAR_COUNT; i += 1) {
      let peak = 0
      for (let j = 0; j < per; j += 1) {
        peak = Math.max(peak, Math.abs(channel[i * per + j] ?? 0))
      }
      peaks.push(peak)
      loudest = Math.max(loudest, peak)
    }
    return loudest > 0 ? peaks.map((p) => Math.max(0.08, p / loudest)) : null
  } catch {
    return null
  }
}

/**
 * The quiz's audio question: one big play button with the clip drawn as a
 * waveform beneath it, filling in the accent colour as it plays. It sits in
 * the same box a photo or video would, so nothing on the screen moves between
 * question types.
 */
export function QuizAudioPlayer({
  url,
  accentColor,
  textColor,
}: {
  url: string
  accentColor: string
  textColor: string
}) {
  const { t } = useTranslation('live')
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [peaks, setPeaks] = useState<number[] | null>(null)

  const fallback = useMemo(() => placeholderPeaks(url), [url])

  useEffect(() => {
    let cancelled = false
    void decodePeaks(url).then((real) => {
      if (!cancelled && real) setPeaks(real)
    })
    return () => {
      cancelled = true
    }
  }, [url])

  const bars = peaks ?? fallback

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }

  return (
    <div className="flex size-full flex-col items-center justify-center gap-4 px-4">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setProgress(0)
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget
          setProgress(el.duration > 0 ? el.currentTime / el.duration : 0)
        }}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t('player.pause') : t('player.play')}
        className="xp-interactive flex size-16 shrink-0 items-center justify-center rounded-full shadow-lg active:scale-95 sm:size-20"
        style={{ backgroundColor: accentColor }}
      >
        {playing ? (
          <Pause className="size-7 fill-current text-black sm:size-9" />
        ) : (
          <Play className="ml-1 size-7 fill-current text-black sm:size-9" />
        )}
      </button>

      {/* The waveform is the clock: it fills as the clip plays. */}
      <div className="flex h-16 w-full max-w-md items-center justify-center gap-[2px] sm:h-20">
        {bars.map((peak, i) => {
          const played = i / bars.length <= progress
          return (
            <span
              key={i}
              className="w-full rounded-full transition-colors"
              style={{
                height: `${Math.round(peak * 100)}%`,
                minHeight: '3px',
                backgroundColor: played ? accentColor : textColor,
                opacity: played ? 1 : 0.35,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
