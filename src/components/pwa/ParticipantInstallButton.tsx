import { Download } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useInstallPrompt } from '@/hooks/use-install-prompt'

/**
 * "Add to home screen" for players.
 *
 * The admin guide lists four platforms in a modal, which is the wrong shape
 * here: a player is on one phone, mid-event, and the screen's job is to get
 * them into a team. So this is one quiet pill that either opens the native
 * dialog or reveals a single line telling them where the option lives, and it
 * disappears entirely once there is nothing left to offer.
 */
const MANUAL_STEP_KEYS: Record<string, string> = {
  ios: 'install.manual.ios',
  android: 'install.manual.android',
  'macos-safari': 'install.manual.macosSafari',
}

export function ParticipantInstallButton({ className }: { className?: string }) {
  const { t } = useTranslation('common')
  const { method, platform, promptInstall } = useInstallPrompt()
  const [showSteps, setShowSteps] = useState(false)

  if (!method) return null

  // Chromium after a dismissed prompt reports 'guide' with no manual platform;
  // its own menu wording is the browser-menu one.
  const steps = t(MANUAL_STEP_KEYS[platform ?? 'android'])

  return (
    <div className={`flex flex-col items-center gap-2 text-center ${className ?? ''}`}>
      <button
        type="button"
        className="xp-interactive flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-sm font-bold text-black shadow-sm"
        onClick={() => {
          if (method === 'prompt') {
            void promptInstall()
            return
          }
          setShowSteps((open) => !open)
        }}
        aria-expanded={method === 'prompt' ? undefined : showSteps}
      >
        <Download className="size-4" aria-hidden />
        {t('install.addToHomeScreen')}
      </button>
      {showSteps && method === 'guide' ? (
        <p className="max-w-xs text-sm font-semibold drop-shadow-sm">{steps}</p>
      ) : null}
    </div>
  )
}
