import {
  LayoutGrid,
  Monitor,
  Palette,
  PanelTop,
  Smartphone,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { PageHead } from '@/components/marketing/PageHead'
import { PlaceholderImage } from '@/components/marketing/PlaceholderImage'
import { NeoButton, NeoCard, NeoIconContainer } from '@/components/neo-minimal'
import {
  formatEventLimit,
  formatPerEventPrice,
  formatSubscriptionPrice,
  getVisiblePlans,
} from '@/lib/subscription-plans'

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Four games, endless rounds',
    body: 'Photo challenges, video challenges, live quizzes, and music bingo. Mix them into one event and switch stages on the fly.',
    imageLabel: 'Photo game screenshot',
    imageAlt: 'Placeholder for RallyHub photo challenge game on participant phones',
  },
  {
    icon: Trophy,
    title: 'Real-time scoring',
    body: "Points land the moment they're earned. Leaderboards update live across every screen — no spreadsheets, no waiting.",
    imageLabel: 'Leaderboard screenshot',
    imageAlt: 'Placeholder for RallyHub real-time team leaderboard',
  },
  {
    icon: Monitor,
    title: 'Built for the big screen',
    body: 'A dedicated display view with live leaderboards, reveals, and celebrations designed to look great on a projector or TV.',
    imageLabel: 'Event display screenshot',
    imageAlt: 'Placeholder for RallyHub big-screen event display',
  },
  {
    icon: Smartphone,
    title: 'Players use their phones',
    body: 'Teams join with a link or QR code — no app to install. They submit, answer, and play from their own devices.',
    imageLabel: 'Participant phone UI',
    imageAlt: 'Placeholder for RallyHub participant experience on mobile',
  },
  {
    icon: Palette,
    title: 'Your brand, every event',
    body: 'Drop in your logo and colors per event. The whole experience matches you or your client.',
    imageLabel: 'Branded event screens',
    imageAlt: 'Placeholder for RallyHub custom event branding on display and phones',
  },
  {
    icon: PanelTop,
    title: 'Run it yourself',
    body: 'Set up an event in minutes and host it live with a clean facilitator panel. No production crew required.',
    imageLabel: 'Live facilitator panel',
    imageAlt: 'Placeholder for RallyHub facilitator panel during a live event',
  },
] as const

const STEPS = [
  {
    step: '1',
    title: 'Build your event',
    body: "Pick your games, set the stages, add your branding. Save it and you're ready.",
    imageLabel: 'Admin event setup',
    imageAlt: 'Placeholder for RallyHub event creation in the admin console',
  },
  {
    step: '2',
    title: 'Invite your teams',
    body: 'Share a link or QR code. Players join on their phones in seconds.',
    imageLabel: 'Team join lobby',
    imageAlt: 'Placeholder for RallyHub team join and lobby screen',
  },
  {
    step: '3',
    title: 'Run it live',
    body: 'Control everything from the facilitator panel — start games, review submissions, advance rounds.',
    imageLabel: 'Live facilitator panel',
    imageAlt: 'Placeholder for RallyHub facilitator panel during a live event',
  },
  {
    step: '4',
    title: 'Crown the winners',
    body: 'Reveal the leaderboard and celebrate on the big screen with confetti and a winner moment.',
    imageLabel: 'Winner reveal moment',
    imageAlt: 'Placeholder for RallyHub winner reveal on the event display',
  },
] as const

export function MarketingLandingPage() {
  const plans = getVisiblePlans()

  return (
    <div className="neo-minimal-scope neo-minimal-inset min-h-svh">
      <PageHead
        title="RallyHub — Live Team Games & Event Scoring Platform"
        description="Run live team-building games with real-time scoring, big-screen displays, and players' phones. Photo, video, quiz, and music bingo — for event companies and teams running their own."
        path="/"
      />
      <MarketingHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute -right-24 top-0 size-72 rounded-full opacity-40 blur-3xl"
            aria-hidden
            style={{ background: 'color-mix(in srgb, var(--nm-yellow) 35%, transparent)' }}
          />
          <div
            className="pointer-events-none absolute -left-16 bottom-0 size-64 rounded-full opacity-30 blur-3xl"
            aria-hidden
            style={{ background: 'var(--nm-bg-muted)' }}
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 sm:px-10 lg:grid-cols-2 lg:gap-14 lg:px-14 lg:py-24">
            <div className="space-y-6">
              <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                Live team games, run in real time
              </p>
              <h1 className="text-foreground text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.25rem]">
                Turn any room into a competition.
              </h1>
              <p className="text-muted-foreground max-w-xl text-lg leading-relaxed">
                RallyHub runs live team-building games — photo and video challenges, quizzes, and
                music bingo — with real-time scoring on the big screen and every player&apos;s phone.
                Built for event companies and teams who want to run it themselves.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <NeoButton variant="accent" size="lg" asChild>
                  <Link to="/contact">Book a Demo</Link>
                </NeoButton>
                <NeoButton variant="surface" size="lg" asChild>
                  <a href="#how-it-works">See how it works</a>
                </NeoButton>
              </div>
            </div>
            <PlaceholderImage
              label="Hero — live event / app overview"
              alt="Placeholder for a hero image showing RallyHub live event with display and participant phones"
              aspect="video"
              className="shadow-[var(--nm-shadow-raised)]"
            />
          </div>
        </section>

        {/* Trust strip */}
        <section
          className="border-y border-[var(--nm-border)] bg-[var(--nm-bg-surface)]"
          aria-label="Trusted by"
        >
          <div className="mx-auto max-w-6xl px-6 py-8 sm:px-10 lg:px-14">
            <p className="text-muted-foreground text-center text-sm font-medium sm:text-base">
              Powering team events, away days, conferences, and game nights.
            </p>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-24 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-14">
            <div className="mb-12 max-w-2xl">
              <h2 className="text-foreground mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need to run the show
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                One platform for the whole event — from the facilitator&apos;s controls to the big
                screen to every player&apos;s hand.
              </p>
            </div>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
              {FEATURES.map((f) => (
                <li key={f.title}>
                  <NeoCard className="flex h-full flex-col gap-4 p-6">
                    <div className="flex items-start gap-4">
                      <NeoIconContainer size="md" accent>
                        <f.icon className="size-5" aria-hidden />
                      </NeoIconContainer>
                      <div>
                        <h3 className="text-foreground text-lg font-semibold">{f.title}</h3>
                        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                          {f.body}
                        </p>
                      </div>
                    </div>
                    <PlaceholderImage
                      label={f.imageLabel}
                      alt={f.imageAlt}
                      aspect="video"
                      className="mt-auto"
                    />
                  </NeoCard>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="scroll-mt-24 border-t border-[var(--nm-border)] bg-[var(--nm-bg-surface)] py-16 lg:py-24"
        >
          <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-14">
            <div className="mb-12 text-center">
              <h2 className="text-foreground mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Live in four steps
              </h2>
            </div>
            <ol className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.step} className="flex flex-col gap-4">
                  <NeoCard className="flex h-full flex-col gap-4 p-5">
                    <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                      Step {s.step}
                    </span>
                    <h3 className="text-foreground text-lg font-semibold">{s.title}</h3>
                    <p className="text-muted-foreground flex-1 text-sm leading-relaxed">
                      {s.body}
                    </p>
                    <PlaceholderImage
                      label={s.imageLabel}
                      alt={s.imageAlt}
                      aspect="square"
                    />
                  </NeoCard>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Two audiences */}
        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-14">
            <div className="mb-12 max-w-2xl">
              <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                Made for two kinds of host
              </h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <NeoCard className="space-y-5 p-8">
                <NeoIconContainer size="lg">
                  <LayoutGrid className="size-6" aria-hidden />
                </NeoIconContainer>
                <h3 className="text-foreground text-2xl font-bold">For event companies</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Run polished, branded events for every client without rebuilding from scratch.
                  Manage all your clients, reuse your game library, and bill per event. RallyHub is
                  your production toolkit.
                </p>
                <NeoButton variant="accent" asChild>
                  <Link to="/contact">Book a Demo</Link>
                </NeoButton>
              </NeoCard>
              <NeoCard className="space-y-5 p-8">
                <NeoIconContainer size="lg" accent>
                  <Sparkles className="size-6" aria-hidden />
                </NeoIconContainer>
                <h3 className="text-foreground text-2xl font-bold">For teams running their own</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Want a team-building session without hiring an agency? Set up a game night for
                  your own team and host it yourself. Start free — your first event is on us.
                </p>
                <NeoButton variant="primary" asChild>
                  <Link to="/login">Start free</Link>
                </NeoButton>
              </NeoCard>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section
          id="pricing"
          className="scroll-mt-24 border-t border-[var(--nm-border)] bg-[var(--nm-bg-surface)] py-16 lg:py-24"
        >
          <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-14">
            <div className="mb-12 text-center">
              <h2 className="text-foreground mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Simple pricing that scales with you
              </h2>
              <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                Pay for the events you run. No surprises.
              </p>
            </div>
            <ul className="grid gap-6 lg:grid-cols-3">
              {plans.map((plan) => (
                <li key={plan.id}>
                  <NeoCard
                    className={`flex h-full flex-col gap-4 p-6 ${plan.id === 'arena' ? 'ring-2 ring-[color-mix(in_srgb,var(--nm-yellow)_45%,transparent)]' : ''}`}
                  >
                    {plan.id === 'arena' ? (
                      <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                        Most popular
                      </span>
                    ) : (
                      <span className="h-4" aria-hidden />
                    )}
                    <h3 className="text-foreground text-xl font-bold">{plan.name}</h3>
                    <p className="text-foreground text-3xl font-bold tracking-tight">
                      {formatSubscriptionPrice(plan, 'monthly')}
                    </p>
                    <p className="text-muted-foreground flex-1 text-sm">
                      {formatPerEventPrice(plan)} · {formatEventLimit(plan)}
                    </p>
                    <NeoButton
                      variant={plan.id === 'rookie' ? 'surface' : 'primary'}
                      className="w-full"
                      asChild
                    >
                      <Link to={plan.id === 'rookie' ? '/login' : '/contact'}>
                        {plan.id === 'rookie' ? 'Start free' : 'Book a Demo'}
                      </Link>
                    </NeoButton>
                  </NeoCard>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-8 text-center text-sm">
              Yearly billing available. Looking for a tailored plan?{' '}
              <Link
                to="/contact"
                className="text-foreground hover:text-foreground/80 font-medium underline underline-offset-2"
              >
                Book a demo
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-14">
            <NeoCard className="relative overflow-hidden p-10 text-center sm:p-14">
              <div
                className="pointer-events-none absolute inset-0 opacity-50"
                aria-hidden
                style={{
                  background:
                    'radial-gradient(ellipse at top right, color-mix(in srgb, var(--nm-yellow) 22%, transparent), transparent 55%)',
                }}
              />
              <div className="relative space-y-6">
                <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                  Ready to get the room on its feet?
                </h2>
                <p className="text-muted-foreground mx-auto max-w-xl text-lg">
                  See RallyHub in action and find the right fit for your events.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <NeoButton variant="accent" size="lg" asChild>
                    <Link to="/contact">Book a Demo</Link>
                  </NeoButton>
                  <NeoButton variant="ghost" size="lg" asChild>
                    <Link to="/login">Log in</Link>
                  </NeoButton>
                </div>
              </div>
            </NeoCard>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
