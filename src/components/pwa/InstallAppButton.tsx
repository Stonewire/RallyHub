import { Download } from 'lucide-react'

import type { InstallGuideContext } from '@/components/pwa/InstallGuide'
import { useInstallAction } from '@/components/pwa/use-install-action'
import { NeoButton, type NeoButtonSize, type NeoButtonVariant } from '@/components/neo-minimal'

/**
 * "Install app" in the neo-minimal button style.
 *
 * Renders nothing at all when the app is already installed or the browser has
 * no way to install it, so the control is never present without something to
 * do. On Chromium it opens the real install dialog; everywhere else it opens
 * the written steps. Surfaces with their own button component call
 * useInstallAction directly instead.
 */
export function InstallAppButton({
  context = 'app',
  label = 'Install app',
  variant = 'surface',
  size = 'sm',
  /** Drop the text and the button styling, for icon rows like the admin header. */
  iconOnly = false,
  className,
}: {
  context?: InstallGuideContext
  label?: string
  variant?: NeoButtonVariant
  size?: NeoButtonSize
  iconOnly?: boolean
  className?: string
}) {
  const { method, onClick, guide } = useInstallAction(context)

  if (!method) return null

  return (
    <>
      {iconOnly ? (
        <button type="button" aria-label={label} className={className} onClick={onClick}>
          <Download className="size-4" />
        </button>
      ) : (
        <NeoButton
          type="button"
          variant={variant}
          size={size}
          className={className}
          onClick={onClick}
        >
          <Download className="size-4" aria-hidden />
          {label}
        </NeoButton>
      )}
      {guide}
    </>
  )
}
