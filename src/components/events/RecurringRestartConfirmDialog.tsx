import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconAlert } from '@/components/icons'
import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toLocalDatetime } from '@/lib/event-form-utils'

type RecurringRestartConfirmDialogProps = {
  eventName: string
  /** The finished run's date, shown so it is obvious what is being replaced. */
  currentEventDate: string | null
  confirming: boolean
  onCancel: () => void
  /** ISO string for the next run, or null when the organiser has no date yet. */
  onConfirm: (nextEventDate: string | null) => void
}

/**
 * P6.4: confirm re-arming a recurring event for its next run. Same shape as
 * the demo-clear activation dialog (use-event-activation-flow): what gets
 * wiped in plain words, plus a highlighted note that the next activation is
 * billed as a new run.
 *
 * The date is asked for here rather than left to a later edit. The restart used
 * to keep the finished run's date, which sorted the re-armed event back among
 * last month's, dropped it out of a date-filtered list, and printed the old
 * date on the new run's invoice. Left empty the date is cleared rather than
 * kept, so an event with no date yet reads as "date not set" instead of quietly
 * claiming a day that has already passed.
 */
export function RecurringRestartConfirmDialog({
  eventName,
  currentEventDate,
  confirming,
  onCancel,
  onConfirm,
}: RecurringRestartConfirmDialogProps) {
  const { t } = useTranslation('admin')
  // Deliberately NOT prefilled with the old date: a prefilled field invites a
  // straight confirm, which is exactly the stale date this asks about.
  const [nextDate, setNextDate] = useState('')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="recurring-restart-title"
      aria-describedby="recurring-restart-message"
    >
      <Card className="border-border/80 w-full max-w-lg space-y-4 bg-card p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <IconAlert
            className="text-primary mt-0.5 size-5 shrink-0"
            aria-hidden
          />
          <div className="min-w-0 space-y-2">
            <h3 id="recurring-restart-title" className="text-foreground font-semibold">
              {t('events.restart.title')}
            </h3>
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium">{eventName}</span>
            </p>
            <p
              id="recurring-restart-message"
              className="text-muted-foreground text-sm leading-relaxed"
            >
              {t('events.restart.message')}
            </p>
            <p className="border-primary/40 bg-primary/10 text-foreground rounded-md border px-3 py-2 text-sm leading-relaxed">
              {t('events.restart.billingNote')}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recurring-restart-date">{t('events.restart.dateLabel')}</Label>
          <Input
            id="recurring-restart-date"
            type="datetime-local"
            className="bg-background"
            value={nextDate}
            disabled={confirming}
            onChange={(e) => setNextDate(e.target.value)}
          />
          <p className="text-muted-foreground text-xs leading-relaxed">
            {currentEventDate
              ? t('events.restart.dateHintWithCurrent', {
                  date: toLocalDatetime(currentEventDate).replace('T', ' '),
                })
              : t('events.restart.dateHint')}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <NeoButton type="button" variant="surface" disabled={confirming} onClick={onCancel}>
            {t('common:cancel')}
          </NeoButton>
          <NeoButton
            type="button"
            variant="primary"
            disabled={confirming}
            onClick={() =>
              // datetime-local has no timezone, so it is read in the browser's
              // own zone, which is the organiser's. Same as the event form.
              onConfirm(nextDate ? new Date(nextDate).toISOString() : null)
            }
          >
            {confirming ? t('events.restart.starting') : t('events.restart.confirm')}
          </NeoButton>
        </div>
      </Card>
    </div>
  )
}
