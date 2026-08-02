import { useRef, useState } from 'react'
import { Camera, Video } from 'lucide-react'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { ChallengeBrief } from '@/components/live/ChallengeBrief'
import {
  StickyChallengeAction,
  STICKY_ACTION_SPACER,
} from '@/components/live/StickyChallengeAction'

type ChallengeCaptureBriefingProps = {
  title: string
  description?: string | null
  coverUrl?: string | null
  exampleVideoUrl?: string | null
  accentColor: string
  mediaType: 'photo' | 'video'
  disabled?: boolean
  onStart: () => void
}

/** Press once to run the example at double speed, press again to drop back. */
const FAST_RATE = 2

export function ChallengeCaptureBriefing({
  title,
  description,
  coverUrl,
  exampleVideoUrl,
  accentColor,
  mediaType,
  disabled,
  onStart,
}: ChallengeCaptureBriefingProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [fast, setFast] = useState(false)
  const cta = mediaType === 'video' ? 'Take video' : 'Take photo'
  const Icon = mediaType === 'video' ? Video : Camera

  function toggleSpeed() {
    const next = !fast
    setFast(next)
    if (videoRef.current) videoRef.current.playbackRate = next ? FAST_RATE : 1
  }

  return (
    <div className={`text-center ${STICKY_ACTION_SPACER}`}>
      <h2 className="xp-challenge-title xp-wrap-text mx-auto max-w-2xl px-4 line-clamp-3">
        {title}
      </h2>

      {/* Full bleed: a cover image reads as a cover only when it owns the
          width. Natural height, no frame — the old panel was the letterboxed
          box around a contained image. */}
      {coverUrl ? (
        <img src={coverUrl} alt="" className="mt-4 w-full object-cover" />
      ) : null}

      <ChallengeBrief html={description} />

      {exampleVideoUrl ? (
        <div className="relative mt-5 w-full">
          <p className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
            Example video
          </p>
          <video
            ref={videoRef}
            src={exampleVideoUrl}
            controls
            playsInline
            disablePictureInPicture
            // Downloading someone else's brief is not a participant action, and
            // the native speed menu is replaced by the button below.
            controlsList="nodownload noplaybackrate noremoteplayback"
            className="w-full"
          />
          <button
            type="button"
            onClick={toggleSpeed}
            aria-pressed={fast}
            className="xp-interactive absolute top-8 right-3 rounded-full px-3 py-1.5 text-xs font-black tabular-nums shadow-lg"
            style={{
              backgroundColor: fast ? accentColor : 'rgba(0,0,0,0.55)',
              color: fast ? '#1c1917' : '#ffffff',
            }}
          >
            {FAST_RATE}×
          </button>
        </div>
      ) : null}

      <StickyChallengeAction>
        <LiveAccentButton
          type="button"
          className="mx-auto w-full max-w-sm gap-2 px-6 py-5 text-base"
          accentColor={accentColor}
          disabled={disabled}
          onClick={onStart}
        >
          <Icon className="size-5 shrink-0" />
          {cta}
        </LiveAccentButton>
      </StickyChallengeAction>
    </div>
  )
}
