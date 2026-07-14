import { Link } from 'react-router-dom'

import { useCookieConsent } from '@/contexts/cookie-consent-context'

const LEGAL_LINKS = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'DPA', href: '/dpa' },
  { label: 'Cookies', href: '/cookies' },
  { label: 'Imprint', href: '/imprint' },
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
  const { openPreferences } = useCookieConsent()

  const linkClass =
    'text-muted-foreground hover:text-foreground text-xs font-medium transition-colors underline-offset-4 hover:underline'

  if (inline) {
    return (
      <nav aria-label="Legal" className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
        {LEGAL_LINKS.map((item) => (
          <Link key={item.href} to={item.href} className={linkClass}>
            {item.label}
          </Link>
        ))}
        {showCookiePreferences ? (
          <button type="button" onClick={openPreferences} className={linkClass}>
            Cookie preferences
          </button>
        ) : null}
      </nav>
    )
  }

  return (
    <nav aria-label="Legal" className={className}>
      <ul className="space-y-2 text-sm">
        {LEGAL_LINKS.map((item) => (
          <li key={item.href}>
            <Link to={item.href} className={linkClass}>
              {item.label}
            </Link>
          </li>
        ))}
        {showCookiePreferences ? (
          <li>
            <button type="button" onClick={openPreferences} className={linkClass}>
              Cookie preferences
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  )
}

export { LEGAL_LINKS }
