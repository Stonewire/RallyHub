import { hasAnalyticsConsent, type CookieConsentState } from '@/lib/cookie-consent'

let analyticsLoaded = false

/**
 * Load third-party scripts only when the user has consented.
 * RallyHub does not use non-essential cookies today; this hook point
 * keeps future analytics behind consent.
 */
export function applyConsentScripts(consent: CookieConsentState | null) {
  if (!hasAnalyticsConsent(consent)) {
    analyticsLoaded = false
    return
  }

  if (analyticsLoaded) return
  analyticsLoaded = true

  // Example: window.gtag?.('consent', 'update', { analytics_storage: 'granted' })
}
