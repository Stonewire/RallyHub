import { Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { textOnAccent } from '@/lib/live-event'
import { youtubeEmbedUrl } from '@/lib/youtube'

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/**
 * The quiz's video question.
 *
 * A YouTube link still plays through YouTube's iframe, because that is the
 * only legitimate way to play it, but the player around it is ours: its chrome
 * is off, an opaque cover hides its poster, and the play button, timeline and
 * clock below are the same ones an uploaded file gets. Teams should not have
 * to learn two players in one quiz.
 *
 * YouTube reports its position through the iframe API's own postMessage
 * traffic, which is why no script tag is needed for it.
 */
export function QuizVideoPlayer({
  url,
  accentColor,
  textColor,
}: {
  url: string
  accentColor: string
  textColor: string
}) {
  const { t } = useTranslation('live')
  const embed = youtubeEmbedUrl(url)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  /** Commands and subscription for the YouTube iframe. */
  function post(func: string, args: unknown[] = []) {
    frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*',
    )
  }

  useEffect(() => {
    if (!embed) return
    const frame = frameRef.current
    if (!frame) return

    // Ask the player to start reporting, then read its position updates.
    const hello = window.setInterval(() => {
      frame.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 'rallyhub-quiz-video' }),
        '*',
      )
    }, 500)

    function onMessage(event: MessageEvent) {
      if (!event.origin.includes('youtube')) return
      try {
        const data = JSON.parse(String(event.data))
        const info = data?.info
        if (!info) return
        if (typeof info.currentTime === 'number') setCurrent(info.currentTime)
        if (typeof info.duration === 'number' && info.duration > 0) setDuration(info.duration)
        // 1 = playing, 2 = paused, 0 = ended.
        if (typeof info.playerState === 'number') {
          setPlaying(info.playerState === 1)
          if (info.playerState === 1) setStarted(true)
        }
      } catch {
        // Not a player message; nothing to do.
      }
    }

    window.addEventListener('message', onMessage)
    return () => {
      window.clearInterval(hello)
      window.removeEventListener('message', onMessage)
    }
  }, [embed])

  function toggle() {
    setStarted(true)
    if (embed) {
      post(playing ? 'pauseVideo' : 'playVideo')
      setPlaying((on) => !on)
      return
    }
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
  }

  function seek(seconds: number) {
    setCurrent(seconds)
    if (embed) {
      post('seekTo', [seconds, true])
      return
    }
    if (videoRef.current) videoRef.current.currentTime = seconds
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0

  return (
    <div className="flex size-full flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-xl bg-black">
        {embed ? (
          <iframe
            ref={frameRef}
            src={`${embed}${embed.includes('?') ? '&' : '?'}enablejsapi=1&controls=0&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3`}
            title={t('player.questionVideo')}
            allow="accelerometer; autoplay; encrypted-media; gyroscope"
            className="pointer-events-none size-full"
          />
        ) : (
          <video
            ref={videoRef}
            src={url}
            playsInline
            className="size-full object-contain"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          />
        )}

        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? t('player.pause') : t('player.play')}
          // Opaque until it starts: that also covers YouTube's own poster, so
          // the team sees our player rather than a YouTube thumbnail.
          className={`absolute inset-0 flex items-center justify-center transition-opacity ${
            !started
              ? 'bg-black'
              : playing
                ? 'bg-transparent opacity-0 hover:opacity-100'
                : // Paused, YouTube shows its own titles and end screen; this
                  // covers them so the player still looks like ours.
                  'bg-black/85'
          }`}
        >
          <span
            className="flex size-14 items-center justify-center rounded-full shadow-lg sm:size-16"
            // The glyph is filled with currentColor, so the accent decides it
            // the same way it decides any other ink painted on the brand.
            style={{ backgroundColor: accentColor, color: textOnAccent(accentColor) }}
          >
            {playing ? (
              <Pause className="size-6 fill-current sm:size-8" />
            ) : (
              <Play className="ml-1 size-6 fill-current sm:size-8" />
            )}
          </span>
        </button>
      </div>

      {/* Scrub back to catch the bit you missed, without leaving the question. */}
      <div className="flex shrink-0 items-center gap-2 rounded-b-xl bg-black/80 px-3 py-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? t('player.pause') : t('player.play')}
          className="shrink-0 text-white"
        >
          {playing ? (
            <Pause className="size-4 fill-current" />
          ) : (
            <Play className="size-4 fill-current" />
          )}
        </button>
        <span className="shrink-0 text-[11px] font-semibold text-white tabular-nums">
          {clock(current)}
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(duration))}
          value={Math.floor(current)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label={t('player.videoPosition')}
          className="h-1 min-w-0 flex-1 appearance-none rounded-full"
          style={{
            background: `linear-gradient(to right, ${accentColor} ${progress}%, ${textColor}59 ${progress}%)`,
          }}
        />
        <span className="shrink-0 text-[11px] font-semibold text-white/70 tabular-nums">
          {clock(duration)}
        </span>
      </div>
    </div>
  )
}
