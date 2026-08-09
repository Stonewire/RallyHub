import { Link } from 'react-router-dom'

import { RallyLogo } from '@/components/brand/RallyLogo'
import { LEGAL_LINKS } from '@/components/legal/LegalFooterLinks'

const PRODUCT_LINKS = [
  { label: 'Why RallyHub', href: '/#why' },
  { label: 'Event builder', href: '/#product' },
  { label: 'Branding', href: '/#branding' },
  { label: 'The store', href: '/#store' },
] as const

export function MarketingHomeFooter() {
  return (
    <footer className="mk-footer">
      <div className="mk-wrap flex flex-col gap-10 py-14 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xs space-y-3">
          <RallyLogo mark="wordmark" theme="dark" className="h-8 w-auto" />
          <p className="text-sm leading-relaxed">
            One easy place to build, brand and run team events that bring the whole room together.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          <nav aria-label="Product">
            <p className="mb-3 text-sm font-extrabold" style={{ color: 'var(--mk-ivory-text)' }}>
              Product
            </p>
            <ul className="space-y-2 text-sm">
              {PRODUCT_LINKS.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Get started">
            <p className="mb-3 text-sm font-extrabold" style={{ color: 'var(--mk-ivory-text)' }}>
              Get started
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#contact">Book a demo</a>
              </li>
              <li>
                <Link to="/register">Register</Link>
              </li>
              <li>
                <Link to="/login">Log in</Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Legal">
            <p className="mb-3 text-sm font-extrabold" style={{ color: 'var(--mk-ivory-text)' }}>
              Legal
            </p>
            <ul className="space-y-2 text-sm">
              {LEGAL_LINKS.map((item) => (
                <li key={item.href}>
                  <Link to={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--mk-coal-line)' }}>
        <div className="mk-wrap flex flex-col items-center gap-2 py-6 text-xs sm:flex-row sm:justify-between">
          <span>© 2026 RallyHub, a Stonewire Technologies product.</span>
          <span>Stronger Teams, one game at a time.</span>
        </div>
      </div>
      <div className="mk-footer-base" aria-hidden />
    </footer>
  )
}
