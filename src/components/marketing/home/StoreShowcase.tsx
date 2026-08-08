import { Coins, Hammer, ShoppingBag, Sparkles } from 'lucide-react'

import { Reveal } from './Reveal'

const STORE_ITEMS = [
  { name: 'Premium build kit', cost: 120, note: 'The good glue lives here' },
  { name: 'Double points card', cost: 200, note: 'Next challenge counts twice' },
  { name: 'Sabotage: lights out', cost: 150, note: 'One rival team, one minute' },
] as const

export function StoreShowcase() {
  return (
    <section id="store" className="scroll-mt-20 py-16 lg:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-14 lg:px-12">
        <Reveal>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.05em]">
            The event store
          </p>
          <h2 className="text-foreground font-sans mt-3 text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-4xl">
            Digital points. <span className="text-muted-foreground">Physical consequences.</span>
          </h2>
          <p className="text-muted-foreground mt-4 max-w-lg text-lg leading-relaxed">
            Teams earn points on their phones and spend them in the event store on real items in
            the room: build materials, power-ups, sabotage cards, whatever your format calls for.
            It is the bridge between screen and table that turns a quiz into a story.
          </p>
          <p className="text-foreground mt-6 max-w-lg text-lg font-semibold leading-relaxed">
            Win the photo round, buy the good glue, build the better tower.
          </p>
          <ul className="text-muted-foreground mt-8 grid gap-3 text-sm" aria-label="How the store works">
            <li className="flex items-start gap-2.5">
              <Coins className="mt-0.5 size-4 shrink-0 text-[var(--mkt-gold)]" aria-hidden />
              Points from any game become store budget for the team.
            </li>
            <li className="flex items-start gap-2.5">
              <ShoppingBag className="mt-0.5 size-4 shrink-0 text-[var(--mkt-gold)]" aria-hidden />
              Orders land on the facilitator screen for handover in the room.
            </li>
            <li className="flex items-start gap-2.5">
              <Hammer className="mt-0.5 size-4 shrink-0 text-[var(--mkt-gold)]" aria-hidden />
              Purchases feed physical build and challenge stages.
            </li>
          </ul>
        </Reveal>

        <Reveal delay={1} className="relative mx-auto w-full max-w-sm" aria-label="Illustration of the in-event store on a player phone">
          <div className="mkt-phone-screen rounded-[1.6rem] border border-[var(--nm-border)] bg-[var(--nm-bg-elevated)] p-5 shadow-xl">
            <div className="mkt-notch" />
            <div className="mt-1 flex items-center justify-between">
              <p className="mkt-phone-kicker">Event store</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--nm-yellow)_28%,transparent)] px-2.5 py-1 text-xs font-bold text-[var(--nm-charcoal)] dark:text-[var(--nm-yellow)]">
                <Coins className="size-3.5" aria-hidden />
                340 pts
              </span>
            </div>
            <div className="mt-4 grid gap-2.5">
              {STORE_ITEMS.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--nm-border)] bg-[var(--nm-bg-surface)] p-3"
                >
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-bold">{item.name}</p>
                    <p className="text-muted-foreground truncate text-xs">{item.note}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-[var(--nm-charcoal)] px-2.5 py-1.5 text-xs font-bold text-[var(--nm-yellow)]">
                    {item.cost} pts
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--nm-yellow)_18%,transparent)] p-3 text-xs font-semibold text-[var(--nm-charcoal)] dark:text-[var(--nm-yellow)]">
              <Sparkles className="size-4 shrink-0" aria-hidden />
              Order sent. Collect your kit from the host table.
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
