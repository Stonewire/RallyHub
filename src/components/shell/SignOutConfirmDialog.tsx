import { IconSignOut } from '@/components/icons'
import { useEffect } from 'react'

import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'

type SignOutConfirmDialogProps = {
  signingOut: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Sign-out confirmation, shaped like the app's other confirm dialogs.
 *
 * This used to be a bare window.confirm, which was the last native browser
 * dialog left in the product: it looks like a browser warning rather than part
 * of RallyHub, and headless or kiosk browsers can suppress it outright, which
 * silently turns sign-out into a no-op.
 */
export function SignOutConfirmDialog({
  signingOut,
  onCancel,
  onConfirm,
}: SignOutConfirmDialogProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-[10200] flex items-center justify-center bg-black/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sign-out-title"
      aria-describedby="sign-out-message"
      onClick={onCancel}
    >
      <Card
        className="border-border/80 bg-card w-full max-w-md space-y-4 p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <IconSignOut className="text-foreground mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 space-y-2">
            <h3 id="sign-out-title" className="text-foreground font-semibold">
              Log out of RallyHub?
            </h3>
            <p id="sign-out-message" className="text-muted-foreground text-sm leading-relaxed">
              You will need to sign in again to get back to your events and games.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <NeoButton type="button" variant="surface" disabled={signingOut} onClick={onCancel}>
            Cancel
          </NeoButton>
          <NeoButton type="button" variant="accent" disabled={signingOut} onClick={onConfirm}>
            {signingOut ? 'Logging out…' : 'Log out'}
          </NeoButton>
        </div>
      </Card>
    </div>
  )
}
