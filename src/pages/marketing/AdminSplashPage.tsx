import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { RallyLogo } from '@/components/brand/RallyLogo'
import { LegalFooterLinks } from '@/components/legal/LegalFooterLinks'
import { PageHead } from '@/components/marketing/PageHead'
import { Reveal } from '@/components/marketing/home/Reveal'

const AREAS = [
  {
    title: 'Client accounts',
    body: 'Create and configure client organisations, plans, promo codes and payments.',
  },
  {
    title: 'Platform game library',
    body: 'The shared catalogue every client can pull from, plus the music and media behind it.',
  },
  {
    title: 'Cross-organisation support',
    body: 'Open a client account to see what they see and sort a problem out mid-event.',
  },
] as const

/**
 * The public root of admin.rallyhub.games. Internal tool, not a sales page:
 * short, signposted, and it tells organisers who land here by mistake where
 * their own workspace lives. Only anonymous visitors reach it.
 *
 * Reads VITE_PLATFORM_HOST the same way auth-routes.ts does, so the "wrong
 * door" link points at whatever host this deploy treats as the app.
 */
export function AdminSplashPage() {
  const appHost = import.meta.env.VITE_PLATFORM_HOST || 'app.rallyhub.games'

  return (
    <div className="mkt flex min-h-svh flex-col overflow-x-clip">
      <PageHead
        title="RallyHub staff portal"
        description="Internal sign-in for the RallyHub platform team."
        path="/"
      />

      <header className="mk-header">
        <div className="mk-wrap mk-header-row">
          <a href="https://rallyhub.games" className="shrink-0" aria-label="RallyHub">
            <RallyLogo mark="full" theme="dark" className="h-10 w-auto sm:h-11" />
          </a>
          <Link to="/login" className="mk-btn mk-btn--sm">
            Sign in
          </Link>
        </div>
      </header>

      <main id="main" className="mk-dark flex-1">
        <div className="mk-wrap mk-section">
          <Reveal className="grid gap-6">
            <span className="mk-kicker">Staff access</span>
            <h1 className="mk-display">RallyHub staff portal.</h1>
            <p className="mk-lead mk-muted">
              Internal sign-in for the RallyHub platform team. Client accounts, the platform game
              library and cross-organisation support all live behind this login.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/login" className="mk-btn">
                Sign in
                <ArrowRight aria-hidden />
              </Link>
            </div>
          </Reveal>

          <Reveal as="ul" delay={1} className="mk-featlist" style={{ maxWidth: '48rem' }}>
            {AREAS.map((area) => (
              <li key={area.title}>
                <h2 className="mk-h3">{area.title}</h2>
                <p>{area.body}</p>
              </li>
            ))}
          </Reveal>

          <Reveal
            delay={2}
            className="mt-12 max-w-xl rounded-[var(--mk-radius)] p-6"
            style={{ border: '1px solid var(--mk-coal-line)' }}
          >
            <h2 className="mk-h3">Running events, not the platform?</h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--mk-mut-d)' }}>
              This is the wrong door. Organisers, event managers and facilitators sign in at{' '}
              <a href={`https://${appHost}`} style={{ color: 'var(--mk-yellow)' }}>
                {appHost}
              </a>
              .
            </p>
          </Reveal>
        </div>
      </main>

      <footer className="mk-footer">
        <div className="mk-wrap flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xs space-y-3">
            <RallyLogo mark="wordmark" theme="dark" className="h-8 w-auto" />
            <p className="text-sm leading-relaxed">Stronger Teams, one game at a time.</p>
          </div>
          <a href="https://rallyhub.games" className="mk-link text-sm">
            Back to rallyhub.games
          </a>
        </div>

        <div style={{ borderTop: '1px solid var(--mk-coal-line)' }}>
          <div className="mk-wrap flex flex-col items-center gap-3 py-6 text-xs sm:flex-row sm:justify-between">
            <span>© 2026 RallyHub, a Stonewire Technologies product.</span>
            {/*
              .mk-footer's unlayered `a` rule already colours the legal links for
              this footer; the cookie-preferences control is a <button>, so it
              needs forcing to the same colour or it keeps the app theme's token.
            */}
            <LegalFooterLinks
              inline
              className="justify-center [&_button]:text-[color:var(--mk-mut-d)]! [&_button:hover]:text-[color:var(--mk-ivory-text)]!"
            />
          </div>
        </div>
        <div className="mk-footer-base" aria-hidden />
      </footer>
    </div>
  )
}
