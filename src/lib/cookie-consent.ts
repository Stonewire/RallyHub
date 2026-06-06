export const COOKIE_CONSENT_VERSION = 1 as const
export const COOKIE_CONSENT_STORAGE_KEY = 'rallyhub-cookie-consent'

export type CookieCategory = 'essential' | 'analytics' | 'preferences'

export type CookieConsentState = {
  version: typeof COOKIE_CONSENT_VERSION
  decidedAt: string
  essential: true
  analytics: boolean
  preferences: boolean
}

export function defaultConsent(): CookieConsentState {
  return {
    version: COOKIE_CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    essential: true,
    analytics: false,
    preferences: false,
  }
}

export function acceptAllConsent(): CookieConsentState {
  return {
    version: COOKIE_CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    essential: true,
    analytics: true,
    preferences: true,
  }
}

export function rejectNonEssentialConsent(): CookieConsentState {
  return defaultConsent()
}

export function readStoredConsent(): CookieConsentState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CookieConsentState
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null
    if (parsed.essential !== true) return null
    return parsed
  } catch {
    return null
  }
}

export function writeStoredConsent(consent: CookieConsentState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent))
  } catch {
    // Storage may be blocked in private mode or by browser policy.
  }
}

export function hasAnalyticsConsent(consent: CookieConsentState | null): boolean {
  return Boolean(consent?.analytics)
}

export function hasPreferencesConsent(consent: CookieConsentState | null): boolean {
  return Boolean(consent?.preferences)
}
