import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  acceptAllConsent,
  defaultConsent,
  readStoredConsent,
  rejectNonEssentialConsent,
  writeStoredConsent,
  type CookieConsentState,
} from '@/lib/cookie-consent'
import { applyConsentScripts } from '@/lib/consent-scripts'

type CookieConsentContextValue = {
  consent: CookieConsentState | null
  hasDecided: boolean
  preferencesOpen: boolean
  acceptAll: () => void
  rejectNonEssential: () => void
  savePreferences: (analytics: boolean, preferences: boolean) => void
  openPreferences: () => void
  closePreferences: () => void
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null)

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<CookieConsentState | null>(() => readStoredConsent())
  const [preferencesOpen, setPreferencesOpen] = useState(false)

  const persist = useCallback((next: CookieConsentState) => {
    writeStoredConsent(next)
    setConsent(next)
    applyConsentScripts(next)
    setPreferencesOpen(false)
  }, [])

  useEffect(() => {
    applyConsentScripts(consent)
  }, [consent])

  const acceptAll = useCallback(() => {
    persist(acceptAllConsent())
  }, [persist])

  const rejectNonEssential = useCallback(() => {
    persist(rejectNonEssentialConsent())
  }, [persist])

  const savePreferences = useCallback(
    (analytics: boolean, preferences: boolean) => {
      persist({
        ...defaultConsent(),
        analytics,
        preferences,
      })
    },
    [persist],
  )

  const openPreferences = useCallback(() => setPreferencesOpen(true), [])
  const closePreferences = useCallback(() => setPreferencesOpen(false), [])

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      hasDecided: consent !== null,
      preferencesOpen,
      acceptAll,
      rejectNonEssential,
      savePreferences,
      openPreferences,
      closePreferences,
    }),
    [
      consent,
      preferencesOpen,
      acceptAll,
      rejectNonEssential,
      savePreferences,
      openPreferences,
      closePreferences,
    ],
  )

  return (
    <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- companion hook for CookieConsentProvider
export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext)
  if (!ctx) {
    throw new Error('useCookieConsent must be used within CookieConsentProvider')
  }
  return ctx
}
