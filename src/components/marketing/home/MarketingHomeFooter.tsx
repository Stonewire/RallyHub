import { Link } from 'react-router-dom'

import { RallyLogo } from '@/components/brand/RallyLogo'
import { LEGAL_LINKS } from '@/components/legal/LegalFooterLinks'

const PRODUCT_LINKS = [
  { label: 'Why RallyHub', href: '#why' },
  { label: 'Event builder', href: '#product' },
  { label: 'Branding', href: '#branding' },
  { label: 'How it works', href: '#how' },
] as const

export function MarketingHomeFooter() {
  return (
    <footer className="mkt-show border-t border-[var(--mkt-show-border)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-14 sm:px-8 lg:flex-row lg:items-start lg:justify-between lg:px-12">
        <div className="max-w-xs space-y-3">
          <RallyLogo mark="wordmark" theme="dark" className="h-8 w-auto" />
          <p className="text-[color:var(--mkt-show-muted)] text-sm leading-relaxed">
            One easy place to build, brand and run team events that bring the whole room together.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          <nav aria-label="Product">
            <p className="mb-3 text-sm font-semibold text-[color:var(--mkt-show-text)]">Product</p>
            <ul className="space-y-2 text-sm">
              {PRODUCT_LINKS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-[color:var(--mkt-show-muted)] transition-colors hover:text-[color:var(--mkt-show-text)]"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Get started">
            <p className="mb-3 text-sm font-semibold text-[color:var(--mkt-show-text)]">
              Get started
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="#contact"
                  className="text-[color:var(--mkt-show-muted)] transition-colors hover:text-[color:var(--mkt-show-text)]"
                >
                  Book a demo
                </a>
              </li>
              <li>
                <Link
                  to="/register"
                  className="text-[color:var(--mkt-show-muted)] transition-colors hover:text-[color:var(--mkt-show-text)]"
                >
                  Register
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="text-[color:var(--mkt-show-muted)] transition-colors hover:text-[color:var(--mkt-show-text)]"
                >
                  Log in
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Legal">
            <p className="mb-3 text-sm font-semibold text-[color:var(--mkt-show-text)]">Legal</p>
            <ul className="space-y-2 text-sm">
              {LEGAL_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className="text-[color:var(--mkt-show-muted)] transition-colors hover:text-[color:var(--mkt-show-text)]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <div className="border-t border-[var(--mkt-show-border)]">
        <div className="text-[color:var(--mkt-show-muted)] mx-auto flex max-w-6xl flex-col items-center gap-2 px-5 py-6 text-xs sm:flex-row sm:justify-between sm:px-8 lg:px-12">
          <span>© 2026 RallyHub. All rights reserved.</span>
          <span>Stronger Teams, one game at a time.</span>
        </div>
      </div>
    </footer>
  )
}
