import { Link } from 'react-router-dom'

import { RallyLogo } from '@/components/brand/RallyLogo'
import { ThemeToggle } from '@/components/brand/ThemeToggle'
import { NeoButton } from '@/components/neo-minimal'

const NAV = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Contact', href: '/contact' },
] as const

export function MarketingHeader() {
  return (
    <header className="neo-minimal-inset sticky top-0 z-50 border-b border-[var(--nm-border)] bg-[color-mix(in_srgb,var(--nm-bg-surface)_92%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4 sm:px-10 lg:px-14">
        <Link to="/" className="shrink-0" aria-label="RallyHub home">
          <RallyLogo className="h-8 w-auto sm:h-9" />
        </Link>
        <nav
          className="order-3 flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium sm:order-2 sm:w-auto sm:justify-start"
          aria-label="Primary"
        >
          {NAV.map((item) =>
            item.href.startsWith('/') ? (
              <Link
                key={item.href}
                to={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.href}
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            ),
          )}
        </nav>
        <div className="order-2 flex shrink-0 items-center gap-2 sm:order-3">
          <ThemeToggle />
          <NeoButton variant="ghost" size="sm" asChild>
            <Link to="/login">Login</Link>
          </NeoButton>
          <NeoButton variant="accent" size="sm" asChild>
            <Link to="/contact">Book a Demo</Link>
          </NeoButton>
        </div>
      </div>
    </header>
  )
}
