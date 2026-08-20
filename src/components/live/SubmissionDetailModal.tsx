import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { NeoButton, NeoStatusBadge } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import {
  CHALLENGE_VIDEO_FRAME_CLASS,
  CHALLENGE_REVIEW_MEDIA_CLASS,
} from '@/lib/challenge-camera'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichText } from '@/components/ui/rich-text'
import {
  expectedTextAnswerLabel,
  puzzleSubmissionStatLabel,
  textAnswerVerdict,
  textSubmissionDisplayLabel,
  type TextAnswerVerdict,
} from '@/lib/text-game'
import type { Tables } from '@/types/helpers'

type SubmissionDetailModalProps = {
  sub: Tables<'submissions'>
  teamName: string
  gameName: string
  game?: Tables<'games'> | null
  pointsType: string
  pointsMin: number | null
  pointsMax: number | null
  pointsStatic: number | null
  onClose: () => void
  onApprove: (points: number) => Promise<void>
  onReject: () => Promise<void>
}

export function SubmissionDetailModal({
  sub,
  teamName,
  gameName,
  game,
  pointsType,
  pointsMin,
  pointsMax,
  pointsStatic,
  onClose,
  onApprove,
  onReject,
}: SubmissionDetailModalProps) {
  const { t } = useTranslation('facilitator')
  const isRange = pointsType === 'range'
  const min = pointsMin ?? 0
  const max = pointsMax ?? 0
  const [points, setPoints] = useState(
    isRange ? '' : String(pointsStatic ?? 0),
  )
  const [busy, setBusy] = useState(false)
  const isText = sub.media_type === 'text'
  const answerLabel =
    isText && game ? textSubmissionDisplayLabel(game, sub.media_url) : sub.media_url ?? ''
  // A judged text game has no right answer, so there may be nothing to show the
  // facilitator beyond the optional notes the organiser left. Read strictly by
  // the game's mode: text games carry leftovers from the other mode and the
  // wrong field prints convincing nonsense.
  const textReferenceLabel = isText && game ? expectedTextAnswerLabel(game) : null
  const verdict: TextAnswerVerdict | null =
    isText && game ? textAnswerVerdict(game, sub.media_url) : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const parsed = Number(points)
  const rangeValid =
    !isRange ||
    (points.trim() !== '' &&
      !Number.isNaN(parsed) &&
      parsed >= min &&
      parsed <= max)

  async function handleApprove() {
    if (isRange && !rangeValid) return
    setBusy(true)
    try {
      await onApprove(isRange ? parsed : (pointsStatic ?? 0))
      onClose()
    } finally {
      setBusy(false)
    }
  }

  async function handleReject() {
    setBusy(true)
    try {
      await onReject()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="neo-minimal-scope bg-card border-border/80 flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="submission-modal-title"
      >
        <div className="border-border/80 flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0 pr-2">
            <p id="submission-modal-title" className="truncate text-lg font-black">
              {teamName}
            </p>
            <p className="text-muted-foreground truncate text-sm font-semibold">{gameName}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={t('submissionDetail.closeSubmission')} onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {game?.description?.trim() ? (
            <div className="border-border/80 mb-4 rounded-lg border bg-muted/20 px-4 py-3">
              <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                {t('submissionDetail.challengeDescription')}
              </p>
              <RichText
                html={game.description}
                className="mt-2 text-sm leading-relaxed whitespace-pre-wrap break-words"
              />
            </div>
          ) : null}
          {game?.solution_description?.trim() ? (
            <div className="border-border/80 mb-4 rounded-lg border border-dashed bg-muted/20 px-4 py-3">
              <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                {t('submissionDetail.expectedAnswer')}
              </p>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap break-words">
                {game.solution_description}
              </p>
            </div>
          ) : null}
          {sub.media_type === 'puzzle' ? (
            <div className="rounded-lg border bg-muted/30 px-4 py-3">
              <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                {t('submissionDetail.puzzleResult')}
              </p>
              <p className="mt-1 text-base font-semibold">
                {puzzleSubmissionStatLabel(sub.media_url)}
                {sub.points_awarded != null
                  ? ` · ${t('submissionDetail.pointsAwarded', { points: sub.points_awarded })}`
                  : ''}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {t('submissionDetail.scoredAutomatically')}
              </p>
            </div>
          ) : isText && answerLabel ? (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                  {t('submissionDetail.teamAnswer')}
                </p>
                <p className="mt-1 text-base font-semibold break-words">{answerLabel}</p>
              </div>
              {/* The reference answer in full, never truncated: the options
                  that caused trouble differ only in their last few words. */}
              {textReferenceLabel ? (
                <div className="rounded-lg border bg-muted/30 px-4 py-3">
                  <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                    {t('submissionDetail.correctAnswer')}
                  </p>
                  <p className="mt-1 text-base font-semibold break-words">
                    {textReferenceLabel}
                  </p>
                  {verdict && verdict !== 'unknown' ? (
                    <p
                      className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                        verdict === 'correct'
                          ? 'bg-emerald-600 text-white'
                          : verdict === 'close'
                            ? 'bg-amber-500 text-black'
                            : 'bg-rose-600 text-white'
                      }`}
                    >
                      {verdict === 'correct'
                        ? t('submissionDetail.verdictMatches')
                        : verdict === 'close'
                          ? t('submissionDetail.verdictClose')
                          : t('submissionDetail.verdictNoMatch')}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : sub.media_url ? (
            sub.media_type === 'video' ? (
              <div className={CHALLENGE_VIDEO_FRAME_CLASS}>
                <video
                  src={sub.media_url}
                  controls
                  className={CHALLENGE_REVIEW_MEDIA_CLASS}
                />
              </div>
            ) : sub.media_type === 'photo' ? (
              <img
                src={sub.media_url}
                alt=""
                className="max-h-[42svh] w-full rounded-lg object-contain"
              />
            ) : null
          ) : (
            <p className="text-muted-foreground text-sm">{t('submissionDetail.noMedia')}</p>
          )}
          {sub.status === 'pending' && sub.media_type !== 'puzzle' ? (
            <div className="mt-4 space-y-4">
              {isRange ? (
                <div className="space-y-2">
                  <Label htmlFor="sub-points">
                    {t('submissionDetail.pointsLabel', { min, max })}
                  </Label>
                  <Input
                    id="sub-points"
                    type="number"
                    min={min}
                    max={max}
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                    className="bg-background"
                  />
                  {!rangeValid && points !== '' ? (
                    <p className="text-destructive text-xs">
                      {t('submissionDetail.pointsRangeError', { min, max })}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="flex gap-2">
                <NeoButton
                  className="flex-1"
                  variant="primary"
                  disabled={busy || (isRange && !rangeValid)}
                  onClick={() => void handleApprove()}
                >
                  {t('submissions.approve')}
                </NeoButton>
                <NeoButton
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => void handleReject()}
                >
                  {t('submissions.reject')}
                </NeoButton>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2">
              <NeoStatusBadge
                tone={
                  sub.status === 'approved' || sub.media_type === 'puzzle'
                    ? 'active'
                    : sub.status === 'rejected'
                      ? 'attention'
                      : 'ready'
                }
              >
                {t(`submissions.status.${sub.media_type === 'puzzle' ? 'approved' : sub.status}`)}
              </NeoStatusBadge>
              {sub.points_awarded != null ? (
                <span className="text-sm font-bold tabular-nums">
                  {sub.points_awarded} {t('common:pts')}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
