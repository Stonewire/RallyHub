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
import { MarketingImage } from '@/components/marketing/MarketingImage'
import { NeoButton, NeoCard, NeoIconContainer } from '@/components/neo-minimal'
import {
  formatEventLimit,
  formatMonthlyEquivalentPrice,
  formatPerEventPrice,
  formatYearlyPrice,
  getPaidPlans,
} from '@/lib/subscription-plans'

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Four games, endless rounds',
    body: 'Photo challenges, video challenges, live quizzes, and music bingo. Mix them into one event and switch stages on the fly.',
    image: '/marketing/feature-photo.png',
    imageLabel: 'Photo game screenshot',
    imageAlt: 'RallyHub photo challenge game on participant phones',
  },
  {
    icon: Trophy,
    title: 'Real-time scoring',
    body: "Points land the moment they're earned. Leaderboards update live across every screen — no spreadsheets, no waiting.",
    image: '/marketing/feature-leaderboard.png',
    imageLabel: 'Leaderboard screenshot',
    imageAlt: 'RallyHub real-time team leaderboard',
  },
  {
    icon: Monitor,
    title: 'Built for the big screen',
    body: 'A dedicated display view with live leaderboards, reveals, and celebrations designed to look great on a projector or TV.',
    image: '/marketing/feature-display.png',
    imageLabel: 'Event display screenshot',
    imageAlt: 'RallyHub big-screen event display',
  },
  {
    icon: Smartphone,
    title: 'Players use their phones',
    body: 'Teams join with a link or QR code — no app to install. They submit, answer, and play from their own devices.',
    image: '/marketing/feature-phone.png',
    imageLabel: 'Participant phone UI',
    imageAlt: 'RallyHub participant experience on mobile',
  },
  {
    icon: Palette,
    title: 'Your brand, every event',
    body: 'Drop in your logo and colors per event. The whole experience matches you or your client.',
    image: '/marketing/feature-branding.png',
    imageLabel: 'Branded event screens',
    imageAlt: 'RallyHub custom event branding on display and phones',
  },
  {
    icon: PanelTop,
    title: 'Run it yourself',
    body: 'Set up an event in minutes and host it live with a clean facilitator panel. No production crew required.',
    image: '/marketing/feature-facilitator.png',
    imageLabel: 'Live facilitator panel',
    imageAlt: 'RallyHub facilitator panel during a live event',
  },
] as const

const STEPS = [
  {
    step: '1',
    title: 'Build your event',
    body: "Pick your games, set the stages, add your branding. Save it and you're ready.",
    image: '/marketing/step-setup.png',
    imageLabel: 'Admin event setup',
    imageAlt: 'RallyHub event creation in the admin console',
  },
  {
    step: '2',
    title: 'Invite your teams',
    body: 'Share a link or QR code. Players join on their phones in seconds.',
    image: '/marketing/step-join.png',
    imageLabel: 'Team join lobby',
    imageAlt: 'RallyHub team join and lobby screen',
  },
  {
    step: '3',
    title: 'Run it live',
    body: 'Control everything from the facilitator panel — start games, review submissions, advance rounds.',
    image: '/marketing/step-live.png',
    imageLabel: 'Live facilitator panel',
    imageAlt: 'RallyHub facilitator panel during a live event',
  },
  {
    step: '4',
    title: 'Crown the winners',
    body: 'Reveal the leaderboard and celebrate on the big screen with confetti and a winner moment.',
    image: '/marketing/step-winner.png',
    imageLabel: 'Winner reveal moment',
    imageAlt: 'RallyHub winner reveal on the event display',
  },
] as const

export function MarketingLandingPage() {
  const plans = getPaidPlans()

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
              <h1 className="text-foreground font-display text-5xl font-normal leading-[1.05] tracking-tight sm:text-6xl lg:text-[4rem]">
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
            <MarketingImage
              src="/marketing/hero.png"
              label="Hero — live event / app overview"
              alt="RallyHub live event with the big-screen display and participant phones"
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
              <h2 className="text-foreground mb-4 font-display text-3xl font-normal tracking-tight sm:text-4xl">
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
                    <MarketingImage
                      src={f.image}
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
              <h2 className="text-foreground mb-4 font-display text-3xl font-normal tracking-tight sm:text-4xl">
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
                    <MarketingImage
                      src={s.image}
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
              <h2 className="text-foreground font-display text-3xl font-normal tracking-tight sm:text-4xl">
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
              <h2 className="text-foreground mb-4 font-display text-3xl font-normal tracking-tight sm:text-4xl">
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
                    className={`flex h-full flex-col gap-4 p-6 ${plan.id === 'pro' ? 'ring-2 ring-[color-mix(in_srgb,var(--nm-yellow)_45%,transparent)]' : ''}`}
                  >
                    {plan.id === 'pro' ? (
                      <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                        Most popular
                      </span>
                    ) : (
                      <span className="h-4" aria-hidden />
                    )}
                    <h3 className="text-foreground text-xl font-bold">{plan.name}</h3>
                    <div>
                      <p className="text-foreground text-3xl font-bold tracking-tight">
                        {formatYearlyPrice(plan)}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatMonthlyEquivalentPrice(plan)} · billed yearly
                      </p>
                    </div>
                    <ul className="text-muted-foreground flex-1 space-y-1.5 text-sm">
                      <li>{formatPerEventPrice(plan)}</li>
                      <li>{formatEventLimit(plan)}</li>
                      {plan.customBranding ? (
                        <li className="text-foreground font-medium">
                          Completely custom branding across the app & deliverables
                        </li>
                      ) : null}
                      <li className="text-foreground font-medium">1 month free trial</li>
                    </ul>
                    <div className="flex flex-col gap-2">
                      <NeoButton variant="primary" className="w-full" asChild>
                        <Link to={`/register?plan=${plan.id}`}>Start for free</Link>
                      </NeoButton>
                      <NeoButton variant="surface" className="w-full" asChild>
                        <Link to="/contact">Book a demo</Link>
                      </NeoButton>
                    </div>
                  </NeoCard>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-8 text-center text-sm">
              No subscription? {' '}
              <Link
                to="/register?plan=rookie"
                className="text-foreground hover:text-foreground/80 font-medium underline underline-offset-2"
              >
                Or start with a Free plan
              </Link>
              {' '}— pay only €150 per event, one event a month.
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
                <h2 className="text-foreground font-display text-3xl font-normal tracking-tight sm:text-4xl">
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
