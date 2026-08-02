import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { CookiePreferencesDialog } from '@/components/legal/CookiePreferencesDialog'
import { NeoButton, NeoCard } from '@/components/neo-minimal'
import { useCookieConsent } from '@/contexts/cookie-consent-context'

export function CookieConsentBanner() {
  const { hasDecided, rejectNonEssential, preferencesOpen } = useCookieConsent()
  const { pathname } = useLocation()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberately delays the banner one tick past mount to avoid a flash before consent context settles
    setMounted(true)
  }, [])

  if (!mounted) return null

  if (preferencesOpen) {
    return <CookiePreferencesDialog />
  }

  if (hasDecided) return null

  // A player joining an event gets one card, not two: the join notice says the
  // same thing about storage and records the same decision.
  if (pathname.startsWith('/join/')) return null

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
            choices. Nothing else. Analytics and preference cookies stay off.{' '}
            <Link to="/cookies" className="text-foreground font-medium underline-offset-4 hover:underline">
              Cookie Policy
            </Link>
            .
          </p>
        </div>
        {/* One button, and it grants nothing beyond what the app cannot run
            without. Analytics stay off, so there is no "accept all" to press
            and nothing here for a dark pattern to nudge. Anyone who does want
            to turn optional cookies on later has Cookie preferences in the
            footer. */}
        <div className="shrink-0">
          <NeoButton
            type="button"
            variant="primary"
            size="md"
            className="w-full sm:w-auto"
            onClick={rejectNonEssential}
          >
            Got it
          </NeoButton>
        </div>
      </NeoCard>
    </div>
  )
}
