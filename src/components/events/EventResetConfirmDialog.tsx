import { IconAlert } from '@/components/icons'
import { useTranslation } from 'react-i18next'

import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'

type EventResetConfirmDialogProps = {
  eventName: string
  confirming: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function EventResetConfirmDialog({
  eventName,
  confirming,
  onCancel,
  onConfirm,
}: EventResetConfirmDialogProps) {
  const { t } = useTranslation('admin')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="event-reset-title"
      aria-describedby="event-reset-message"
    >
      <Card className="border-border/80 w-full max-w-lg space-y-4 bg-card p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <IconAlert
            className="text-destructive mt-0.5 size-5 shrink-0"
            aria-hidden
          />
          <div className="min-w-0 space-y-2">
            <h3 id="event-reset-title" className="text-foreground font-semibold">
              {t('events.reset.title')}
            </h3>
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium">{eventName}</span>
            </p>
            <p id="event-reset-message" className="text-muted-foreground text-sm leading-relaxed">
              {t('events.reset.message')}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <NeoButton type="button" variant="surface" disabled={confirming} onClick={onCancel}>
            {t('common:cancel')}
          </NeoButton>
          <NeoButton
            type="button"
            variant="destructive"
            disabled={confirming}
            onClick={onConfirm}
          >
            {confirming ? t('events.reset.resetting') : t('events.reset.confirm')}
          </NeoButton>
        </div>
      </Card>
    </div>
  )
}
