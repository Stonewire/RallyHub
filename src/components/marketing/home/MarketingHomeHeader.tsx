import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { RallyLogo } from '@/components/brand/RallyLogo'
import { ThemeToggle } from '@/components/brand/ThemeToggle'
import { NeoButton } from '@/components/neo-minimal'

const NAV = [
  { label: 'Why RallyHub', href: '#why' },
  { label: 'Product', href: '#product' },
  { label: 'Branding', href: '#branding' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
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
    <header className="sticky top-0 z-50 border-b border-[var(--nm-border)] bg-[color-mix(in_srgb,var(--nm-bg-surface)_92%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-[62px] max-w-6xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <Link to="/" className="shrink-0" aria-label="RallyHub home">
          <RallyLogo mark="wordmark" className="h-7 w-auto sm:h-8" />
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/login"
            className="text-muted-foreground hover:text-foreground hidden px-2 text-sm font-medium transition-colors sm:inline-block"
          >
            Log in
          </Link>
          <NeoButton variant="accent" size="sm" asChild className="hidden sm:inline-flex">
            <a href="#contact">Book a demo</a>
          </NeoButton>
          <button
            type="button"
            className="text-foreground hover:bg-[var(--nm-bg-muted)] -mr-1 rounded-lg p-2 transition-colors md:hidden"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            aria-controls="mkt-mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      <div id="mkt-mobile-menu" className="mkt-mobile-menu md:hidden" data-open={open}>
        {NAV.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="mkt-mm-link"
            onClick={() => setOpen(false)}
          >
            {item.label}
          </a>
        ))}
        <div className="mt-2 grid gap-2">
          <NeoButton variant="accent" asChild>
            <a href="#contact" onClick={() => setOpen(false)}>
              Book a demo
            </a>
          </NeoButton>
          <NeoButton variant="surface" asChild>
            <Link to="/login" onClick={() => setOpen(false)}>
              Log in
            </Link>
          </NeoButton>
        </div>
      </div>
    </header>
  )
}
