import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { CookiePreferencesDialog } from '@/components/legal/CookiePreferencesDialog'
import { NeoButton, NeoCard } from '@/components/neo-minimal'
import { useCookieConsent } from '@/contexts/cookie-consent-context'

export function CookieConsentBanner() {
  const { hasDecided, acceptAll, rejectNonEssential, openPreferences, preferencesOpen } =
    useCookieConsent()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  if (preferencesOpen) {
    return <CookiePreferencesDialog />
  }

  if (hasDecided) return null

  return (
    <div
      className="neo-minimal-scope fixed inset-x-0 bottom-0 z-[100] p-4 sm:p-6"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
    >
      <NeoCard className="mx-auto flex max-w-4xl flex-col gap-4 border border-[var(--nm-border)] p-5 shadow-lg sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:p-6">
        <div className="min-w-0 space-y-2">
          <h2 id="cookie-consent-title" className="text-foreground text-sm font-semibold">
            Cookies &amp; privacy
          </h2>
          <p id="cookie-consent-description" className="text-muted-foreground text-sm leading-relaxed">
            We use essential cookies and local storage to keep you signed in and remember your
            choices. Optional analytics and preference cookies are off unless you allow them.{' '}
            <Link to="/cookies" className="text-foreground font-medium underline-offset-4 hover:underline">
              Cookie Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <NeoButton
            type="button"
            variant="surface"
            size="md"
            className="w-full sm:w-auto"
            onClick={rejectNonEssential}
          >
            Reject non-essential
          </NeoButton>
          <NeoButton
            type="button"
            variant="surface"
            size="md"
            className="w-full sm:w-auto"
            onClick={openPreferences}
          >
            Manage preferences
          </NeoButton>
          <NeoButton
            type="button"
            variant="primary"
            size="md"
            className="w-full sm:w-auto"
            onClick={acceptAll}
          >
            Accept all
          </NeoButton>
        </div>
      </NeoCard>
    </div>
  )
}
