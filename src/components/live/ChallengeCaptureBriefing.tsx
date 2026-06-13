import { Camera, Video } from 'lucide-react'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { textOnAccent } from '@/lib/live-event'

type ChallengeCaptureBriefingProps = {
  title: string
  description?: string | null
  pointsLabel: string
  coverUrl?: string | null
  accentColor: string
  mediaType: 'photo' | 'video'
  disabled?: boolean
  onStart: () => void
}

export function ChallengeCaptureBriefing({
  title,
  description,
  pointsLabel,
  coverUrl,
  accentColor,
  mediaType,
  disabled,
  onStart,
}: ChallengeCaptureBriefingProps) {
  const onAccent = textOnAccent(accentColor)
  const cta = mediaType === 'video' ? 'Take video' : 'Take photo'
  const Icon = mediaType === 'video' ? Video : Camera

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-2 py-6 text-center">
        <h2 className="max-w-md text-2xl font-bold leading-tight sm:text-3xl">{title}</h2>
        <span
          className="mt-4 inline-flex rounded-full px-5 py-2 text-sm font-bold tracking-wide sm:text-base"
          style={{ backgroundColor: accentColor, color: onAccent }}
        >
          {pointsLabel}
        </span>
        {description ? (
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/90 sm:text-lg">
            {description}
          </p>
        ) : null}
        <LiveAccentButton
          type="button"
          className="mt-8 w-full max-w-xs gap-2 px-6 py-6 text-base sm:text-lg"
          accentColor={accentColor}
          disabled={disabled}
          onClick={onStart}
        >
          <Icon className="size-5 shrink-0" />
          {cta}
        </LiveAccentButton>
      </div>
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          className="mt-2 w-full max-h-48 shrink-0 rounded-xl object-cover object-center shadow-lg sm:max-h-56"
        />
      ) : null}
    </div>
  )
}
