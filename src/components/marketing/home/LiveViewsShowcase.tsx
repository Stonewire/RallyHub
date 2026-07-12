import { Monitor, Smartphone, SlidersHorizontal } from 'lucide-react'

import { NeoCard } from '@/components/neo-minimal'

import { Reveal } from './Reveal'

export function LiveViewsShowcase() {
  return (
    <section className="border-t border-[var(--nm-border)] bg-[var(--nm-bg-surface)] py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-12">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.05em]">
            Three purpose-built views
          </p>
          <h2 className="text-foreground font-display mt-3 text-3xl font-normal leading-[1.12] tracking-tight sm:text-4xl">
            The right screen <span className="text-muted-foreground">for everyone in the room.</span>
          </h2>
          <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
            The host stays in control, teams stay in the game, and the big screen keeps everyone
            part of the same moment.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          <Reveal>
            <NeoCard className="flex h-full flex-col gap-4 p-6">
              <span className="text-muted-foreground inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.04em]">
                <SlidersHorizontal className="size-4" aria-hidden />
                The host
              </span>
              <h3 className="text-foreground text-lg font-bold">Control without clutter</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Stages, timers, scoring, submissions and messaging in one facilitator view.
              </p>
              <div className="mkt-window mt-auto" aria-hidden>
                <div className="mkt-chrome" style={{ padding: '0.45rem 0.6rem' }}>
                  <span className="mkt-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span style={{ fontSize: '0.6rem' }}>Facilitator</span>
                </div>
                <div className="grid grid-cols-[64px_1fr] gap-2 p-3">
                  <div className="grid gap-1.5">
                    <span className="h-2 rounded bg-[var(--nm-bg-muted)]" />
                    <span className="h-2 rounded bg-[var(--nm-bg-muted)]" />
                    <span className="h-2 rounded bg-[color-mix(in_srgb,var(--nm-yellow)_60%,transparent)]" />
                    <span className="h-2 rounded bg-[var(--nm-bg-muted)]" />
                  </div>
                  <div className="grid gap-2">
                    <span className="h-12 rounded-md bg-[var(--nm-bg-muted)]" />
                    <div className="grid grid-cols-2 gap-2">
                      <span className="h-6 rounded bg-[var(--nm-bg-muted)]" />
                      <span className="h-6 rounded bg-[var(--nm-bg-muted)]" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="h-5 rounded bg-[var(--nm-bg-muted)]" />
                      <span className="h-5 rounded bg-[var(--nm-bg-muted)]" />
                      <span className="h-5 rounded bg-[var(--nm-bg-muted)]" />
                    </div>
                  </div>
                </div>
              </div>
            </NeoCard>
          </Reveal>

          <Reveal delay={1}>
            <NeoCard className="flex h-full flex-col gap-4 p-6">
              <span className="text-muted-foreground inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.04em]">
                <Monitor className="size-4" aria-hidden />
                The room
              </span>
              <h3 className="text-foreground text-lg font-bold">Built for the big screen</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Leaderboards, answers, breaks, bingo wins and the final podium, projector ready.
              </p>
              <div className="mkt-device-display mt-auto">
                <img
                  src="/marketing/rallyhub-display.jpg"
                  alt="RallyHub leaderboard shown in the dedicated audience display view"
                  loading="lazy"
                  width={1280}
                  height={720}
                />
              </div>
            </NeoCard>
          </Reveal>

          <Reveal delay={2}>
            <NeoCard className="flex h-full flex-col gap-4 p-6">
              <span className="text-muted-foreground inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.04em]">
                <Smartphone className="size-4" aria-hidden />
                The teams
              </span>
              <h3 className="text-foreground text-lg font-bold">Join and play in the browser</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Scan the QR, pick a team and start playing. No app store detour and no second login.
              </p>
              <div className="mkt-device-phone mt-auto" aria-hidden>
                <div className="mkt-phone-screen">
                  <div className="mkt-notch" />
                  <p className="mkt-phone-kicker">Question 6 of 10</p>
                  <h4 className="text-foreground mt-1 text-sm font-bold">Which city never sleeps?</h4>
                  <div className="mkt-answer-grid">
                    <span>Paris</span>
                    <span>New York</span>
                    <span>Rome</span>
                    <span>Tokyo</span>
                  </div>
                </div>
              </div>
            </NeoCard>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
