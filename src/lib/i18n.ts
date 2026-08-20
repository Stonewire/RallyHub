import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// English is bundled statically and initialised synchronously. Modules outside
// React (billing errors, export failures) call i18n.t at import-adjacent times
// and tests never boot the app, so an async English load would hand both of
// them raw keys. The other four languages still load on demand.
import enAdmin from '../locales/en/admin.json'
import enCommon from '../locales/en/common.json'
import enFacilitator from '../locales/en/facilitator.json'
import enLive from '../locales/en/live.json'

export type AppLanguage = 'en' | 'bg' | 'es' | 'fr' | 'nl'

export const APP_LANGUAGES: { code: AppLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'bg', label: 'Български' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'nl', label: 'Nederlands' },
]

const NAMESPACES = ['common', 'live', 'facilitator', 'admin'] as const

function isAppLanguage(value: string): value is AppLanguage {
  return APP_LANGUAGES.some((entry) => entry.code === value)
}

/** Unknown/missing codes fall back to English. */
export function toAppLanguage(value: string | null | undefined): AppLanguage {
  return value && isAppLanguage(value) ? value : 'en'
}

const EN_RESOURCES = {
  common: enCommon,
  live: enLive,
  facilitator: enFacilitator,
  admin: enAdmin,
} as const

const loaded = new Set<string>(['en'])

/**
 * Synchronous English bootstrap, run at module load. initI18n stays for the
 * async paths that also want to await it, but t() works from the first tick.
 */
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    ns: [...NAMESPACES],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    resources: { en: EN_RESOURCES },
  })
}

async function loadLanguage(lang: AppLanguage): Promise<void> {
  if (loaded.has(lang)) return
  const bundles = await Promise.all(
    NAMESPACES.map(async (ns) => ({
      ns,
      resources: (await import(`../locales/${lang}/${ns}.json`)).default,
    })),
  )
  for (const bundle of bundles) {
    i18n.addResourceBundle(lang, bundle.ns, bundle.resources, true, true)
  }
  loaded.add(lang)
}

let initPromise: Promise<void> | null = null

/** Idempotent bootstrap. English is already in place synchronously above. */
export function initI18n(): Promise<void> {
  initPromise ??= Promise.resolve()
  return initPromise
}

/**
 * A team's own language on a multilingual event, pinned for this tab only.
 *
 * Live surfaces normally follow the event language, but on a multilingual
 * event each team picks its own on the phone in front of it. The pin lets the
 * participant choice win over the bundle's event language without the display
 * screen or the facilitator panel, which are shared and stay on the event
 * language, ever seeing it.
 */
let participantLanguage: AppLanguage | null = null

/** Pins (or with null, clears) this tab's participant language. */
export async function setParticipantLanguage(lang: string | null): Promise<void> {
  participantLanguage = lang ? toAppLanguage(lang) : null
  await applyLanguage(participantLanguage ?? 'en')
}

export function getParticipantLanguage(): AppLanguage | null {
  return participantLanguage
}

/**
 * Activates the event's language unless this tab has a participant pin, in
 * which case the pin wins. Live surfaces call this whenever the bundle loads.
 */
export async function setLiveLanguage(eventLanguage: string): Promise<void> {
  await applyLanguage(participantLanguage ?? toAppLanguage(eventLanguage))
}

async function applyLanguage(target: AppLanguage): Promise<void> {
  await loadLanguage(target)
  if (i18n.language !== target) await i18n.changeLanguage(target)
}

/** Loads and activates a language; unknown codes fall back to English. */
export async function setAppLanguage(lang: string): Promise<void> {
  await applyLanguage(toAppLanguage(lang))
}

/**
 * The initialised i18next instance. Non-React modules must import this rather
 * than 'i18next' directly: importing this module is what guarantees English is
 * registered before the first t() call.
 */
export { i18n }
