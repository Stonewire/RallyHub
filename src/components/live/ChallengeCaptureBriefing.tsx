import { useRef, useState } from 'react'
import { Camera, Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { ChallengeBrief } from '@/components/live/ChallengeBrief'
import {
  StickyChallengeAction,
  CHALLENGE_ACTION_CLASS,
  STICKY_ACTION_SPACER,
} from '@/components/live/StickyChallengeAction'
import { youTubeEmbedUrl } from '@/lib/video-embed'

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
  const { t } = useTranslation('live')
  const videoRef = useRef<HTMLVideoElement>(null)
  const [fast, setFast] = useState(false)
  const cta =
    mediaType === 'video' ? t('join.capture.takeVideo') : t('join.capture.takePhoto')
  const Icon = mediaType === 'video' ? Video : Camera
  const embedUrl = youTubeEmbedUrl(exampleVideoUrl)

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
          {/* No colour class: inherits the event's UI colour (white or black)
              from BrandBackground's displayTextClass, like the rest of the
              screen. The muted grey token ignored that setting. */}
          <p className="mb-1.5 text-sm font-medium tracking-wide uppercase">
            {t('join.capture.exampleVideo')}
          </p>
          {embedUrl ? (
            // A YouTube link cannot play in a <video> tag (dead black box on
            // the 8 Aug test) — it gets YouTube's own player. Speed control
            // lives inside that player, so no 2x button here.
            <iframe
              src={embedUrl}
              title={t('join.capture.exampleVideo')}
              className="aspect-video w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <>
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
            </>
          )}
        </div>
      ) : null}

      <StickyChallengeAction>
        <LiveAccentButton
          type="button"
          className={CHALLENGE_ACTION_CLASS}
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
