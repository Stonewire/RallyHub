import { Link } from 'react-router-dom'

import { RallyLogo } from '@/components/brand/RallyLogo'

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Pricing', href: '/#pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Contact', href: '/contact' },
      { label: 'Book a Demo', href: '/contact' },
    ],
  },
  {
    title: 'Account',
    links: [{ label: 'Login', href: '/login' }],
  },
] as const

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--nm-border)] bg-[var(--nm-bg-surface)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 sm:px-10 lg:flex-row lg:items-start lg:justify-between lg:px-14">
        <div className="max-w-xs space-y-3">
          <RallyLogo className="h-8 w-auto" alt="RallyHub logo" />
          <p className="text-muted-foreground text-sm leading-relaxed">
            Live team games, run in real time.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="text-foreground mb-3 text-sm font-semibold">{column.title}</p>
              <ul className="space-y-2 text-sm">
                {column.links.map((item) => (
                  <li key={`${column.title}-${item.label}`}>
                    <Link
                      to={item.href}
                      className="text-muted-foreground hover:text-foreground font-medium transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-[var(--nm-border)]">
        <p className="text-muted-foreground mx-auto max-w-6xl px-6 py-6 text-center text-xs sm:px-10 lg:px-14">
          © 2026 RallyHub. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
