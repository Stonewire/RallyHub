import { Button } from '@/components/ui/button'
import { RichText } from '@/components/ui/rich-text'
import {
  CHALLENGE_VIDEO_FRAME_CLASS,
  CHALLENGE_VIDEO_MEDIA_CLASS,
} from '@/lib/challenge-camera'
import { gamePointsDisplay, textOnAccent } from '@/lib/live-event'
import { textSubmissionDisplayLabel } from '@/lib/text-game'
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
  const isText = submission.media_type === 'text'
  const answerLabel = isText
    ? textSubmissionDisplayLabel(game, submission.media_url)
    : null

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
        <RichText
          html={game.description}
          className="xp-challenge-description xp-wrap-text mx-auto max-w-md line-clamp-4"
        />
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

      {isText && answerLabel ? (
        <div className="xp-glass-panel mx-auto max-w-md rounded-xl bg-black/30 px-4 py-3 text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-white/60">
            Your answer
          </p>
          <p className="xp-wrap-text mt-1 text-base font-semibold text-white">{answerLabel}</p>
        </div>
      ) : submission.media_url ? (
        submission.media_type === 'video' ? (
          <div className={CHALLENGE_VIDEO_FRAME_CLASS}>
            <video
              src={submission.media_url}
              controls
              playsInline
              className={CHALLENGE_VIDEO_MEDIA_CLASS}
            />
          </div>
        ) : submission.media_type === 'photo' ? (
          <img
            src={submission.media_url}
            alt="Your submission"
            className="mx-auto w-full max-w-md rounded-xl object-contain shadow-lg"
          />
        ) : null
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
