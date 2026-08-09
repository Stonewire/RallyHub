import { ArrowRight, Check } from 'lucide-react'

import { NeoButton } from '@/components/neo-minimal'

import { Reveal } from './Reveal'

export function MarketingHero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div
        className="mkt-ring pointer-events-none absolute -right-24 -top-24 size-80 opacity-40 blur-3xl"
        aria-hidden
        style={{ background: 'color-mix(in srgb, var(--nm-yellow) 32%, transparent)' }}
      />
      <div
        className="mkt-ring pointer-events-none absolute -left-24 top-40 size-72 opacity-30 blur-3xl"
        aria-hidden
        style={{ background: 'var(--nm-bg-muted)' }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:px-12 lg:py-20">
        <Reveal className="space-y-6">
          <p className="mkt-eyebrow">
            <span className="mkt-live-pulse" aria-hidden />
            Event software for people who run events
          </p>
          <h1 className="text-foreground font-sans text-[2.5rem] font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-[3.9rem]">
            Build the format once.{' '}
            <span className="text-[color-mix(in_srgb,var(--nm-yellow)_88%,var(--nm-charcoal))]">
              Tailor every event.
            </span>
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg leading-relaxed">
            RallyHub turns your game library into client-ready team events. Quests, quizzes,
            puzzles and music bingo in one run, on one leaderboard, controlled from one screen.
            Set-up for a new event: about 10 minutes.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <NeoButton variant="accent" size="lg" asChild>
              <a href="#contact">
                Book a demo
                <ArrowRight className="size-4" aria-hidden />
              </a>
            </NeoButton>
            <NeoButton variant="surface" size="lg" asChild>
              <a href="https://demo.rallyhub.games" target="_blank" rel="noreferrer">
                Watch a live event
              </a>
            </NeoButton>
          </div>
          <div className="mkt-micro-proof pt-2" aria-label="Product highlights">
            <span>
              <Check aria-hidden />
              Players join in the browser
            </span>
            <span>
              <Check aria-hidden />
              Join by QR code
            </span>
            <span>
              <Check aria-hidden />
              One live leaderboard
            </span>
          </div>
        </Reveal>

        <Reveal
          delay={1}
          className="relative"
          aria-label="A live RallyHub team event in progress"
        >
          <div className="mkt-hero-photo">
            <img
              src="/marketing/hero-team-event-1600.jpg"
              srcSet="/marketing/hero-team-event-800.jpg 800w, /marketing/hero-team-event-1600.jpg 1600w"
              sizes="(max-width: 1024px) 100vw, 45vw"
              width={1693}
              height={929}
              fetchPriority="high"
              decoding="async"
              alt="Colleagues cheering during a live phone-based team game while a facilitator hosts"
            />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
