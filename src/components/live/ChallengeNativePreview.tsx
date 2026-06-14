import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { Button } from '@/components/ui/button'
import { CHALLENGE_PREVIEW_MEDIA_CLASS } from '@/lib/challenge-camera'

type ChallengeNativePreviewProps = {
  mediaType: 'photo' | 'video'
  previewUrl: string
  accentColor: string
  disabled?: boolean
  onRetake: () => void
  onSubmit: () => void
  onClose: () => void
}

/** Post-capture preview only — native camera is opened before this overlay appears. */
export function ChallengeNativePreview({
  mediaType,
  previewUrl,
  accentColor,
  disabled,
  onRetake,
  onSubmit,
  onClose,
}: ChallengeNativePreviewProps) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="experience-scope fixed inset-0 z-[10000] flex flex-col bg-black">
      <div
        className="flex shrink-0 items-center justify-end px-4 pb-2"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="flex size-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-3">
        <div className="xp-media-frame mx-auto flex w-full max-w-lg items-center justify-center bg-black">
          {mediaType === 'photo' ? (
            <img
              src={previewUrl}
              alt="Preview"
              className={CHALLENGE_PREVIEW_MEDIA_CLASS}
            />
          ) : (
            <video
              src={previewUrl}
              controls
              playsInline
              preload="auto"
              className={CHALLENGE_PREVIEW_MEDIA_CLASS}
            />
          )}
        </div>
      </div>

      <div
        className="shrink-0 space-y-3 px-4 pt-3"
        style={{
          paddingBottom: 'max(5rem, calc(env(safe-area-inset-bottom) + 3.5rem))',
        }}
      >
        <div className="mx-auto flex w-full max-w-lg gap-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-12 flex-1 border-white/30 bg-white/10 text-base text-white"
            onClick={onRetake}
          >
            Retake
          </Button>
          <LiveAccentButton
            type="button"
            className="min-h-12 flex-1 text-base"
            accentColor={accentColor}
            disabled={disabled}
            onClick={onSubmit}
          >
            Submit
          </LiveAccentButton>
        </div>
      </div>
    </div>,
    document.body,
  )
}
