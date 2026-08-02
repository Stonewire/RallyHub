import { useCallback, useState } from 'react'

import { InstallGuide, type InstallGuideContext } from '@/components/pwa/InstallGuide'
import { useInstallPrompt } from '@/hooks/use-install-prompt'

/**
 * The install control, minus the button.
 *
 * Every surface that offers an install uses a different button component: the
 * admin header has its own icon buttons, the facilitator console has
 * FacilitatorButton, the tablet kiosk has the shadcn one. Only the behaviour is
 * shared, so that is all this returns. Render your own button, spread `onClick`
 * on it, hide it when `method` is null, and drop `guide` somewhere in the tree.
 */
export function useInstallAction(context: InstallGuideContext = 'app') {
  const { method, promptInstall } = useInstallPrompt()
  const [guideOpen, setGuideOpen] = useState(false)

  const onClick = useCallback(() => {
    if (method === 'prompt') {
      // On dismissal the hook falls back to 'guide', so the button stays useful.
      void promptInstall()
      return
    }
    setGuideOpen(true)
  }, [method, promptInstall])

  return {
    /** null means this browser cannot install; render no button at all. */
    method,
    onClick,
    guide: guideOpen ? (
      <InstallGuide context={context} onClose={() => setGuideOpen(false)} />
    ) : null,
  }
}
