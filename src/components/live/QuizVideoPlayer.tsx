import { Pause, Play } from 'lucide-react'
import { useRef, useState } from 'react'

import { youtubeEmbedUrl } from '@/lib/youtube'

/**
 * The quiz's video question.
 *
 * A YouTube link still plays through YouTube's iframe, because that is the
 * only legitimate way to play it, but the player it shows is ours: chrome off,
 * related videos off, and one big play button over the top. Uploaded files use
 * the same button over a plain video element, so both look the same to a team.
 */
export function QuizVideoPlayer({
  url,
  accentColor,
}: {
  url: string
  accentColor: string
}) {
  const embed = youtubeEmbedUrl(url)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)

  function toggle() {
    if (embed) {
      // The iframe API without its script: postMessage takes the same commands.
      frameRef.current?.contentWindow?.postMessage(
        JSON.stringify({
          event: 'command',
          func: playing ? 'pauseVideo' : 'playVideo',
          args: [],
        }),
        '*',
      )
      setPlaying((on) => !on)
      setStarted(true)
      return
    }
    const video = videoRef.current
    if (!video) return
    setStarted(true)
    if (video.paused) void video.play()
    else video.pause()
  }

  return (
    <div className="relative size-full overflow-hidden rounded-xl bg-black shadow-lg">
      {embed ? (
        <iframe
          ref={frameRef}
          src={`${embed}${embed.includes('?') ? '&' : '?'}enablejsapi=1&controls=0&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3`}
          title="Question video"
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
        />
      )}

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
        // Opaque until it starts: that also covers YouTube's own poster, so
        // the team sees our player rather than a YouTube thumbnail.
        className={`absolute inset-0 flex items-center justify-center transition-opacity ${
          !started ? 'bg-black' : playing ? 'bg-transparent opacity-0 hover:opacity-100' : 'bg-black/40'
        }`}
      >
        <span
          className="flex size-16 items-center justify-center rounded-full shadow-lg sm:size-20"
          style={{ backgroundColor: accentColor }}
        >
          {playing ? (
            <Pause className="size-7 fill-current text-black sm:size-9" />
          ) : (
            <Play className="ml-1 size-7 fill-current text-black sm:size-9" />
          )}
        </span>
      </button>
    </div>
  )
}
