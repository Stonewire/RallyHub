import { Camera, Video } from 'lucide-react'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { RichText } from '@/components/ui/rich-text'
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
    <div className="space-y-5 pb-4 text-center">
      <h2 className="xp-challenge-title xp-wrap-text mx-auto max-w-md line-clamp-3">
        {title}
      </h2>
      <span
        className="inline-flex rounded-full px-4 py-1.5 text-sm font-bold tracking-wide"
        style={{ backgroundColor: accentColor, color: onAccent }}
      >
        {pointsLabel}
      </span>
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          className="mx-auto w-full max-h-40 rounded-xl object-cover object-center shadow-lg sm:max-h-48"
        />
      ) : null}
      {description ? (
        <RichText
          html={description}
          className="xp-challenge-description xp-wrap-text mx-auto max-w-md line-clamp-4"
        />
      ) : null}
      <LiveAccentButton
        type="button"
        className="mx-auto w-full max-w-xs gap-2 px-6 py-5 text-base"
        accentColor={accentColor}
        disabled={disabled}
        onClick={onStart}
      >
        <Icon className="size-5 shrink-0" />
        {cta}
      </LiveAccentButton>
    </div>
  )
}
