import { IconAlert } from '@/components/icons'
import { useTranslation } from 'react-i18next'

import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'

type RecurringRestartConfirmDialogProps = {
  eventName: string
  confirming: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * P6.4: confirm re-arming a recurring event for its next run. Same shape as
 * the demo-clear activation dialog (use-event-activation-flow): what gets
 * wiped in plain words, plus a highlighted note that the next activation is
 * billed as a new run.
 */
export function RecurringRestartConfirmDialog({
  eventName,
  confirming,
  onCancel,
  onConfirm,
}: RecurringRestartConfirmDialogProps) {
  const { t } = useTranslation('admin')

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
        <div className="flex justify-end gap-2">
          <NeoButton type="button" variant="surface" disabled={confirming} onClick={onCancel}>
            {t('common:cancel')}
          </NeoButton>
          <NeoButton
            type="button"
            variant="primary"
            disabled={confirming}
            onClick={onConfirm}
          >
            {confirming ? t('events.restart.starting') : t('events.restart.confirm')}
          </NeoButton>
        </div>
      </Card>
    </div>
  )
}
