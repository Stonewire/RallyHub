import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { RallyLogo } from '@/components/brand/RallyLogo'
import { RALLYHUB_BOOKING_URL } from '@/constants/contact'

/* Absolute so the header also works on /contact; same-path fragments still scroll in place. */
const NAV = [
  { label: 'Why RallyHub', href: '/#why' },
  { label: 'Product', href: '/#product' },
  { label: 'Branding', href: '/#branding' },
  { label: 'Store', href: '/#store' },
  { label: 'Pricing', href: '/#pricing' },
] as const

export function MarketingHomeHeader() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 900) setOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <header className="mk-header">
      <div className="mk-wrap mk-header-row">
        <Link to="/" className="shrink-0" aria-label="RallyHub home">
          <RallyLogo mark="full" theme="dark" className="h-10 w-auto sm:h-11" />
        </Link>

        <nav className="mk-nav" aria-label="Primary">
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <Link
            to="/login"
            className="hidden px-1 text-sm font-bold sm:inline-block"
            style={{ color: 'var(--mk-mut-d)' }}
          >
            Log in
          </Link>
          <a
            className="mk-btn mk-btn--sm hidden sm:inline-flex"
            href={RALLYHUB_BOOKING_URL}
            target="_blank"
            rel="noreferrer"
          >
            Book a demo
          </a>
          <button
            type="button"
            className="-mr-1 rounded-lg p-2 md:hidden"
            style={{ color: 'var(--mk-ivory-text)' }}
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            aria-controls="mk-mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      <div id="mk-mobile-menu" className="mk-mobile-menu md:hidden" data-open={open}>
        {NAV.map((item) => (
          <a key={item.href} href={item.href} className="mk-mm-link" onClick={() => setOpen(false)}>
            {item.label}
          </a>
        ))}
        <div className="mt-3 grid gap-2">
          <a
            className="mk-btn"
            href={RALLYHUB_BOOKING_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
          >
            Book a demo
          </a>
          <Link className="mk-btn mk-btn--ghost" to="/login" onClick={() => setOpen(false)}>
            Log in
          </Link>
        </div>
      </div>
    </header>
  )
}
