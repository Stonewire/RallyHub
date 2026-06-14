import { Button } from '@/components/ui/button'
import {
  CHALLENGE_VIDEO_FRAME_CLASS,
  CHALLENGE_VIDEO_MEDIA_CLASS,
} from '@/lib/challenge-camera'
import { gamePointsDisplay, textOnAccent } from '@/lib/live-event'
import type { Tables } from '@/types/helpers'

type OpenGameChallengeReviewProps = {
  game: Tables<'games'>
  submission: Tables<'submissions'>
  accentColor: string
  cancelling?: boolean
  onCancel?: () => void
}

export function OpenGameChallengeReview({
  game,
  submission,
  accentColor,
  cancelling,
  onCancel,
}: OpenGameChallengeReviewProps) {
  const onAccent = textOnAccent(accentColor)
  const pending = submission.status === 'pending'
  const approved = submission.status === 'approved'
  const rejected = submission.status === 'rejected'

  const statusHeading = pending
    ? 'Submission pending approval'
    : approved
      ? 'Submission approved'
      : rejected
        ? 'Submission rejected'
        : null

  return (
    <div className="space-y-5 pb-4 text-center">
      <h2 className="xp-challenge-title xp-wrap-text mx-auto max-w-md line-clamp-3">
        {game.name}
      </h2>
      <span
        className="inline-flex rounded-full px-4 py-1.5 text-sm font-bold tracking-wide"
        style={{ backgroundColor: accentColor, color: onAccent }}
      >
        {gamePointsDisplay(game)}
      </span>
      {game.description ? (
        <p className="xp-challenge-description xp-wrap-text mx-auto max-w-md line-clamp-4">
          {game.description}
        </p>
      ) : null}
      {game.cover_url ? (
        <img
          src={game.cover_url}
          alt=""
          className="mx-auto w-full max-h-40 rounded-xl object-cover object-center shadow-lg sm:max-h-48"
        />
      ) : null}

      {statusHeading ? (
        <p className="text-base font-semibold" style={{ color: accentColor }}>
          {statusHeading}
        </p>
      ) : null}

      {submission.media_url ? (
        submission.media_type === 'video' ? (
          <div className={CHALLENGE_VIDEO_FRAME_CLASS}>
            <video
              src={submission.media_url}
              controls
              playsInline
              className={CHALLENGE_VIDEO_MEDIA_CLASS}
            />
          </div>
        ) : (
          <img
            src={submission.media_url}
            alt="Your submission"
            className="mx-auto w-full max-w-md rounded-xl object-contain shadow-lg"
          />
        )
      ) : null}

      {pending && onCancel ? (
        <div className="space-y-2">
          <Button
            className="w-full border-white/30 bg-white/10 text-white"
            variant="outline"
            disabled={cancelling}
            onClick={onCancel}
          >
            {cancelling ? 'Cancelling…' : 'Cancel Submission'}
          </Button>
          <p className="text-xs text-white/60">
            Cancel to retake this challenge from scratch
          </p>
        </div>
      ) : null}
    </div>
  )
}
