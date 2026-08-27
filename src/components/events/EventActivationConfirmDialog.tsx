import { IconAlert } from '@/components/icons'
import { useTranslation } from 'react-i18next'

import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import type { EventActivationWarning } from '@/lib/event-activation-billing'

type EventActivationConfirmDialogProps = {
  eventName: string
  warning: EventActivationWarning
  /** Demo to active only: what happens to the demo run's data (P4.2). */
  demoDataNotice?: string | null
  confirming: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function EventActivationConfirmDialog({
  eventName,
  warning,
  demoDataNotice = null,
  confirming,
  onCancel,
  onConfirm,
}: EventActivationConfirmDialogProps) {
  const { t } = useTranslation('admin')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="event-activation-title"
      aria-describedby="event-activation-message"
    >
      <Card className="border-border/80 w-full max-w-lg space-y-4 bg-card p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <IconAlert
            className="text-primary mt-0.5 size-5 shrink-0"
            aria-hidden
          />
          <div className="min-w-0 space-y-2">
            <h3 id="event-activation-title" className="text-foreground font-semibold">
              {warning.title}
            </h3>
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium">{eventName}</span>
            </p>
            <p id="event-activation-message" className="text-muted-foreground text-sm leading-relaxed">
              {warning.message}
            </p>
            {demoDataNotice ? (
              <p className="border-primary/40 bg-primary/10 text-foreground rounded-md border px-3 py-2 text-sm leading-relaxed">
                {demoDataNotice}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <NeoButton type="button" variant="surface" disabled={confirming} onClick={onCancel}>
            {t('common:cancel')}
          </NeoButton>
          <NeoButton type="button" variant="primary" disabled={confirming} onClick={onConfirm}>
            {confirming ? t('events.activate.activating') : warning.confirmLabel}
          </NeoButton>
        </div>
      </Card>
    </div>
  )
}
