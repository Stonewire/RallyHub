import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import {
  CHALLENGE_VIDEO_FRAME_CLASS,
  CHALLENGE_VIDEO_MEDIA_CLASS,
} from '@/lib/challenge-camera'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseTextGameConfig, textSubmissionDisplayLabel, isTextGame } from '@/lib/text-game'
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
  const textCfg = game ? parseTextGameConfig(game.config) : null

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
        className="bg-card border-border/80 max-h-[92vh] w-full max-w-lg overflow-auto rounded-xl border shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="submission-modal-title"
      >
        <div className="border-border/80 flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0 pr-2">
            <p id="submission-modal-title" className="truncate font-semibold">
              {teamName}
            </p>
            <p className="text-muted-foreground truncate text-sm">{gameName}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="p-4">
          {isText && answerLabel ? (
            <div className="rounded-lg border bg-muted/30 px-4 py-3">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Team answer
              </p>
              <p className="mt-1 text-base font-semibold break-words">{answerLabel}</p>
            </div>
          ) : sub.media_url ? (
            sub.media_type === 'video' ? (
              <div className={CHALLENGE_VIDEO_FRAME_CLASS}>
                <video
                  src={sub.media_url}
                  controls
                  className={CHALLENGE_VIDEO_MEDIA_CLASS}
                />
              </div>
            ) : sub.media_type === 'photo' ? (
              <img
                src={sub.media_url}
                alt=""
                className="max-h-[50vh] w-full rounded-lg object-contain"
              />
            ) : null
          ) : (
            <p className="text-muted-foreground text-sm">No media attached</p>
          )}
          {isText && textCfg && game && isTextGame(game) ? (
            <div className="border-border/80 mt-4 rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Reference for approval
              </p>
              {textCfg.mode === 'type_text' ? (
                <ul className="mt-2 space-y-1">
                  {(textCfg.correctAnswers ?? []).filter((a) => a.length > 0).map((a, i) => (
                    <li key={i} className="font-mono text-sm break-all">{a}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2">
                  Correct:{' '}
                  <span className="font-semibold">
                    {textCfg.options?.find((o) => o.id === textCfg.correctAnswerId)?.text ??
                      '—'}
                  </span>
                </p>
              )}
            </div>
          ) : null}
          {sub.status === 'pending' ? (
            <div className="mt-4 space-y-4">
              {isRange ? (
                <div className="space-y-2">
                  <Label htmlFor="sub-points">
                    Points ({min}–{max})
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
                      Enter a value between {min} and {max}
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
                  Approve
                </NeoButton>
                <NeoButton
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => void handleReject()}
                >
                  Reject
                </NeoButton>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground mt-4 text-sm capitalize">
              Status: {sub.status}
              {sub.points_awarded != null ? ` · ${sub.points_awarded} pts` : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
