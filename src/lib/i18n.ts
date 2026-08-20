import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export type AppLanguage = 'en' | 'bg' | 'es' | 'fr' | 'nl'

export const APP_LANGUAGES: { code: AppLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'bg', label: 'Български' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'nl', label: 'Nederlands' },
]

const NAMESPACES = ['common', 'live', 'facilitator'] as const

function isAppLanguage(value: string): value is AppLanguage {
  return APP_LANGUAGES.some((entry) => entry.code === value)
}

/** Unknown/missing codes fall back to English. */
export function toAppLanguage(value: string | null | undefined): AppLanguage {
  return value && isAppLanguage(value) ? value : 'en'
}

const loaded = new Set<string>()

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

/** Idempotent i18next bootstrap. English loads eagerly as the fallback. */
export function initI18n(): Promise<void> {
  initPromise ??= (async () => {
    await i18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      ns: [...NAMESPACES],
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      resources: {},
    })
    await loadLanguage('en')
  })()
  return initPromise
}

/** Loads and activates a language; unknown codes fall back to English. */
export async function setAppLanguage(lang: string): Promise<void> {
  await initI18n()
  const target: AppLanguage = isAppLanguage(lang) ? lang : 'en'
  await loadLanguage(target)
  if (i18n.language !== target) await i18n.changeLanguage(target)
}
