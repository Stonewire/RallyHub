import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

import { AccentButton } from '@/components/admin/AccentButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Tables } from '@/types/helpers'

type SubmissionDetailModalProps = {
  sub: Tables<'submissions'>
  teamName: string
  gameName: string
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
          {sub.media_url ? (
            sub.media_type === 'video' ? (
              <video
                src={sub.media_url}
                controls
                className="max-h-[50vh] w-full rounded-lg bg-black"
              />
            ) : (
              <img
                src={sub.media_url}
                alt=""
                className="max-h-[50vh] w-full rounded-lg object-contain"
              />
            )
          ) : (
            <p className="text-muted-foreground text-sm">No media attached</p>
          )}
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
                <AccentButton
                  className="flex-1"
                  disabled={busy || (isRange && !rangeValid)}
                  onClick={() => void handleApprove()}
                >
                  Approve
                </AccentButton>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => void handleReject()}
                >
                  Reject
                </Button>
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
