import { Camera, FileText, Puzzle, Video, type LucideIcon } from 'lucide-react'

import { contrastRatio, readableTextOn } from '@/lib/hex-color'
import { gamePointsDisplay } from '@/lib/live-event'
import { isTextGame } from '@/lib/text-game'
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
  /** The event's own text colour, so an untouched tile reads like the rest of
   *  the screen rather than picking its own contrast against the accent. */
  textColor: string
  canSubmit: boolean
  onSelect: () => void
}

function challengeTypeIcon(game: Tables<'games'>): LucideIcon {
  if (isTextGame(game)) return FileText
  if (game.type === 'video') return Video
  if (game.type === 'puzzle') return Puzzle
  return Camera
}

function cardAppearance(
  status: SubmissionStatus | null | undefined,
  accentColor: string,
  textColor: string,
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
    // Keep the event's own text colour, which is the point of the prop: an
    // untouched tile should read like the rest of the screen. Only override it
    // when it is genuinely unreadable on this accent. A white text colour on
    // the default yellow measured 1.52:1, on the tiles a player has to read to
    // choose a challenge, and that is not a look worth preserving.
    color: contrastRatio(textColor, accentColor) >= 4.5 ? textColor : readableTextOn(accentColor),
    statusLabel: null,
  }
}

export function OpenGameChallengeCard({
  game,
  submissionStatus,
  accentColor,
  textColor,
  canSubmit,
  onSelect,
}: OpenGameChallengeCardProps) {
  const approved = submissionStatus === 'approved'
  const rejected = submissionStatus === 'rejected'
  const locked = approved || rejected
  const appearance = cardAppearance(submissionStatus, accentColor, textColor)
  const TypeIcon = challengeTypeIcon(game)
  const isPending = submissionStatus === 'pending'

  return (
    <button
      type="button"
      disabled={locked || !canSubmit}
      className={`xp-game-tile xp-interactive relative flex min-h-[118px] flex-col items-center justify-center gap-2 p-3.5 text-center disabled:cursor-not-allowed disabled:opacity-100 ${
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
      {/* Corner-mounted: the type is a glance-level cue, so it costs no room
          in the middle where the name and the points sit. */}
      {/* eslint-disable-next-line react-hooks/static-components -- TypeIcon picks among 3 stable, pre-existing icon components, doesn't create one */}
      <TypeIcon
        className="absolute top-2 right-2 size-5 shrink-0 opacity-90"
        strokeWidth={1.75}
        aria-hidden
      />

      {/* Inset clears the corner icon: a three-line name reaches the top of
          the tile and used to run underneath it. */}
      <span className="xp-challenge-title xp-wrap-text line-clamp-3 w-full px-6">{game.name}</span>

      <span className="text-base leading-none font-black tabular-nums">
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
