import { AlertTriangle } from 'lucide-react'

import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import type { EventActivationWarning } from '@/lib/event-activation-billing'

type EventActivationConfirmDialogProps = {
  eventName: string
  warning: EventActivationWarning
  confirming: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function EventActivationConfirmDialog({
  eventName,
  warning,
  confirming,
  onCancel,
  onConfirm,
}: EventActivationConfirmDialogProps) {
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
          <AlertTriangle
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
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <NeoButton type="button" variant="surface" disabled={confirming} onClick={onCancel}>
            Cancel
          </NeoButton>
          <NeoButton type="button" variant="primary" disabled={confirming} onClick={onConfirm}>
            {confirming ? 'Activating…' : warning.confirmLabel}
          </NeoButton>
        </div>
      </Card>
    </div>
  )
}
