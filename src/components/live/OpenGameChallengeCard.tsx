import { Camera, Video, type LucideIcon } from 'lucide-react'

import { gamePointsDisplay } from '@/lib/live-event'
import type { Tables } from '@/types/helpers'

const STATUS_PENDING_BG = '#FDE047'
const STATUS_PENDING_TEXT = '#1c1917'
const STATUS_APPROVED_BG = '#16A34A'
const STATUS_REJECTED_BG = '#DC2626'
const STATUS_LIGHT_TEXT = '#ffffff'

type SubmissionStatus = Tables<'submissions'>['status']

type OpenGameChallengeCardProps = {
  game: Tables<'games'>
  submissionStatus?: SubmissionStatus | null
  accentColor: string
  onAccentColor: string
  canSubmit: boolean
  onSelect: () => void
}

function challengeTypeIcon(type: Tables<'games'>['type']): LucideIcon {
  return type === 'video' ? Video : Camera
}

function cardAppearance(
  status: SubmissionStatus | null | undefined,
  accentColor: string,
  onAccentColor: string,
): { backgroundColor: string; color: string; statusLabel: string | null } {
  if (status === 'approved') {
    return {
      backgroundColor: STATUS_APPROVED_BG,
      color: STATUS_LIGHT_TEXT,
      statusLabel: 'Approved',
    }
  }
  if (status === 'rejected') {
    return {
      backgroundColor: STATUS_REJECTED_BG,
      color: STATUS_LIGHT_TEXT,
      statusLabel: 'Rejected',
    }
  }
  if (status === 'pending') {
    return {
      backgroundColor: STATUS_PENDING_BG,
      color: STATUS_PENDING_TEXT,
      statusLabel: 'Pending',
    }
  }
  return {
    backgroundColor: accentColor,
    color: onAccentColor,
    statusLabel: null,
  }
}

export function OpenGameChallengeCard({
  game,
  submissionStatus,
  accentColor,
  onAccentColor,
  canSubmit,
  onSelect,
}: OpenGameChallengeCardProps) {
  const approved = submissionStatus === 'approved'
  const rejected = submissionStatus === 'rejected'
  const locked = approved || rejected
  const appearance = cardAppearance(submissionStatus, accentColor, onAccentColor)
  const TypeIcon = challengeTypeIcon(game.type)
  const isPending = submissionStatus === 'pending'

  return (
    <button
      type="button"
      disabled={locked || !canSubmit}
      className={`xp-game-tile xp-interactive flex min-h-[132px] flex-col items-center justify-center gap-2.5 p-4 text-center disabled:cursor-not-allowed disabled:opacity-100 ${
        locked || !canSubmit ? '' : 'active:scale-[0.98]'
      }`}
      style={{
        backgroundColor: appearance.backgroundColor,
        color: appearance.color,
      }}
      onClick={() => {
        if (!locked && canSubmit) onSelect()
      }}
    >
      <span className="line-clamp-2 text-2xl font-bold leading-tight">{game.name}</span>

      <TypeIcon
        className="size-5 shrink-0 opacity-90"
        strokeWidth={1.75}
        aria-hidden
      />

      <span className="text-xl font-bold tabular-nums leading-none">
        {gamePointsDisplay(game)}
      </span>

      {appearance.statusLabel ? (
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
            isPending
              ? 'bg-black/15 text-inherit'
              : 'bg-white/20 text-inherit'
          }`}
        >
          {appearance.statusLabel}
        </span>
      ) : null}
    </button>
  )
}
