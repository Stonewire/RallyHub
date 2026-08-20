import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useCookieConsent } from '@/contexts/cookie-consent-context'

/**
 * `labelKey` is what the app renders, so the names re-resolve after a language
 * change. `label` stays for the marketing footers, which are English-only and
 * read this list outside any i18n context.
 */
const LEGAL_LINKS = [
  { label: 'Privacy', labelKey: 'legal.privacy', href: '/privacy' },
  { label: 'Terms', labelKey: 'legal.terms', href: '/terms' },
  { label: 'DPA', labelKey: 'legal.dpa', href: '/dpa' },
  { label: 'Cookies', labelKey: 'legal.cookies', href: '/cookies' },
  { label: 'Imprint', labelKey: 'legal.imprint', href: '/imprint' },
] as const

type LegalFooterLinksProps = {
  className?: string
  showCookiePreferences?: boolean
  inline?: boolean
}

export function LegalFooterLinks({
  className = '',
  showCookiePreferences = true,
  inline = false,
}: LegalFooterLinksProps) {
  // Common namespace: this footer also renders on live participant surfaces.
  const { t } = useTranslation('common')
  const { openPreferences } = useCookieConsent()

  const linkClass =
    'text-muted-foreground hover:text-foreground text-xs font-medium transition-colors underline-offset-4 hover:underline'

  if (inline) {
    return (
      <nav
        aria-label={t('legal.navLabel')}
        className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}
      >
        {LEGAL_LINKS.map((item) => (
          <Link key={item.href} to={item.href} className={linkClass}>
            {t(item.labelKey)}
          </Link>
        ))}
        {showCookiePreferences ? (
          <button type="button" onClick={openPreferences} className={linkClass}>
            {t('legal.cookiePreferences')}
          </button>
        ) : null}
      </nav>
    )
  }

  return (
    <nav aria-label={t('legal.navLabel')} className={className}>
      <ul className="space-y-2 text-sm">
        {LEGAL_LINKS.map((item) => (
          <li key={item.href}>
            <Link to={item.href} className={linkClass}>
              {t(item.labelKey)}
            </Link>
          </li>
        ))}
        {showCookiePreferences ? (
          <li>
            <button type="button" onClick={openPreferences} className={linkClass}>
              {t('legal.cookiePreferences')}
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  )
}

export { LEGAL_LINKS }
