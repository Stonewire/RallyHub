import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { QuestGameProgress, QuestGameStatus } from '@/lib/quest-progress'
import type { Tables } from '@/types/helpers'

const STATUS_META: Record<QuestGameStatus, { labelKey: string; cls: string }> = {
  approved: { labelKey: 'quest.completed', cls: 'bg-green-100 text-green-800 border-green-300' },
  pending: { labelKey: 'quest.pending', cls: 'bg-yellow-100 text-yellow-900 border-yellow-300' },
  rejected: { labelKey: 'quest.rejected', cls: 'bg-red-100 text-red-800 border-red-300' },
  none: { labelKey: 'quest.notStarted', cls: 'bg-muted text-muted-foreground border-border' },
}

type TeamQuestProgressModalProps = {
  team: Tables<'teams'>
  items: QuestGameProgress[]
  doneCount: number
  total: number
  onClose: () => void
  /** Open the shared approval modal for a game's submission (approved/pending/rejected). */
  onOpenSubmission: (submission: Tables<'submissions'>) => void
}

export function TeamQuestProgressModal({
  team,
  items,
  doneCount,
  total,
  onClose,
  onOpenSubmission,
}: TeamQuestProgressModalProps) {
  const { t } = useTranslation('facilitator')
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-card border-border/80 max-h-[92vh] w-full max-w-md overflow-auto rounded-xl border shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quest-progress-title"
      >
        <div className="border-border/80 flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0 pr-2">
            <p id="quest-progress-title" className="truncate font-semibold">
              {team.name?.trim() || t('quest.slotFallback', { number: team.slot_number })}
            </p>
            <p className="text-muted-foreground text-sm tabular-nums">
              {t('quest.questsCompleted', { done: doneCount, total })}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={t('quest.closeTeamProgress')} onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <ul className="divide-border divide-y">
          {items.map(({ game, status, submission }) => {
            const meta = STATUS_META[status]
            const clickable = submission != null
            const Row = clickable ? 'button' : 'div'
            return (
              <li key={game.id}>
                <Row
                  type={clickable ? 'button' : undefined}
                  onClick={clickable ? () => onOpenSubmission(submission!) : undefined}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${
                    clickable ? 'hover:bg-muted/30 transition-colors' : ''
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{game.name}</span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.cls}`}
                  >
                    {t(meta.labelKey)}
                  </span>
                </Row>
              </li>
            )
          })}
          {items.length === 0 ? (
            <li className="text-muted-foreground px-4 py-6 text-center text-sm">
              {t('quest.noQuestGames')}
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}
