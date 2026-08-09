import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { RallyLogo } from '@/components/brand/RallyLogo'
import { LegalFooterLinks } from '@/components/legal/LegalFooterLinks'
import { PageHead } from '@/components/marketing/PageHead'
import { ImageSlot } from '@/components/marketing/home/ImageSlot'
import { Reveal } from '@/components/marketing/home/Reveal'

/* Same three-beat framing the marketing site uses, cut short for a login door. */
const STEPS = [
  {
    title: 'Design',
    body: 'Challenges, quizzes and playlists live in your library, ready to reuse.',
  },
  {
    title: 'Adapt',
    body: 'Pick the games, set the stages, drop in the client logo and colours.',
  },
  {
    title: 'Deliver',
    body: 'Run it live from one screen while the room plays on their phones.',
  },
] as const

const LIVE_POINTS = [
  {
    title: 'Approve every submission yourself',
    body: 'Photos, videos and answers land in your queue. Nothing scores until you say it does.',
  },
  {
    title: 'Control what every screen shows',
    body: 'The big display, the leaderboard, every player phone: you decide what the room sees.',
  },
  {
    title: 'Your team, your library',
    body: 'Event managers and facilitators sign in with their own accounts and pick up where you left off.',
  },
] as const

/**
 * The public root of app.rallyhub.games. Only anonymous visitors reach it:
 * RootPage sends anyone with a session on to their post-login home first.
 * Scoped under .mkt so it wears the same visual world as rallyhub.games.
 */
export function AppSplashPage() {
  return (
    <div className="mkt flex min-h-svh flex-col overflow-x-clip">
      <PageHead
        title="Sign in to RallyHub"
        description="The RallyHub client portal. Build your team-building games once, brand every event for the client, and run the whole thing live from one screen."
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

      {/* Coal ground: the last section is coal, so any flex filler on a tall
          viewport blends into the footer instead of flashing an ivory band. */}
      <main id="main" className="flex-1" style={{ background: 'var(--mk-coal)' }}>
        <section className="mk-dark">
          <div className="mk-wrap mk-section">
            <Reveal className="grid gap-6">
              <span className="mk-kicker">Client portal</span>
              <h1 className="mk-display">Sign in and run the event.</h1>
              <p className="mk-lead mk-muted">
                This is the working side of RallyHub. Build your games, brand each event for the
                client, then run the whole thing live from one screen.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link to="/login" className="mk-btn">
                  Sign in
                  <ArrowRight aria-hidden />
                </Link>
                <Link to="/register" className="mk-btn mk-btn--ghost">
                  Create an account
                </Link>
              </div>
              <p className="text-sm" style={{ color: 'var(--mk-mut-d)' }}>
                Already part of an organisation? Ask your admin to add you and sign in with your own
                account.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="mk-sandband">
          <div className="mk-wrap mk-section">
            <Reveal className="mk-head-center">
              <h2 className="mk-h2">Everything for the event, in one place.</h2>
              <p className="mk-lead mk-muted">
                Prep time is money you do not bill for. Every client event after the first is
                assembly, not construction.
              </p>
            </Reveal>

            <Reveal as="ol" className="mk-steps-row">
              {STEPS.map((step) => (
                <li key={step.title}>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </Reveal>

            <Reveal delay={1} className="mk-wide-shot">
              <ImageSlot
                /* Matches the screenshot exactly so object-fit never crops the app chrome. */
                aspect="4370 / 2392"
                label="Event builder"
                photo={{
                  base: '/marketing/app-event-designer',
                  widths: [1000, 1700],
                  alt: 'The RallyHub event builder: event settings, client branding with logo and colours, teams, and the stage list of drag-to-reorder challenges',
                  sizes: '(max-width: 1200px) 100vw, 1200px',
                }}
                caption="The builder behind the login. Branding on the right, stages below, saved as you go."
              />
            </Reveal>
          </div>
        </section>

        <section className="mk-dark">
          <div className="mk-wrap mk-section">
            <div className="mk-fac-grid">
              <Reveal>
                <ImageSlot
                  /* Matches the screenshot exactly so object-fit never crops the app chrome. */
                  aspect="2380 / 2322"
                  label="Facilitator control room"
                  photo={{
                    base: '/marketing/app-facilitator',
                    widths: [1000, 1700],
                    alt: 'The RallyHub facilitator control room: live display preview, event timer, stage tabs, display toggles and a queue of team submissions waiting for approval',
                    sizes: '(max-width: 1024px) 100vw, 700px',
                  }}
                  caption="The live control room. Every control, one screen."
                />
              </Reveal>

              <Reveal delay={1}>
                <h2 className="mk-h2">
                  Then run the room from{' '}
                  <span style={{ color: 'var(--mk-yellow)' }}>one screen.</span>
                </h2>
                <p className="mk-lead mk-muted" style={{ marginTop: '1.1rem' }}>
                  Quests, quizzes, puzzles and music bingo all land on the same leaderboard. Players
                  join in the browser, no app to install.
                </p>
                <ul className="mk-featlist">
                  {LIVE_POINTS.map((point) => (
                    <li key={point.title}>
                      <h3 className="mk-h3">{point.title}</h3>
                      <p>{point.body}</p>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Link to="/login" className="mk-btn">
                    Sign in
                    <ArrowRight aria-hidden />
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </section>
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
