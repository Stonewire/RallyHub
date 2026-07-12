import { NeoCard } from '@/components/neo-minimal'

import { Reveal } from './Reveal'

const STEPS = [
  {
    num: '01',
    title: 'Build the run',
    body: 'Choose games, arrange stages, set scoring and add the event identity.',
  },
  {
    num: '02',
    title: 'Share one QR',
    body: 'Teams join from their own phones and enter the same live experience.',
  },
  {
    num: '03',
    title: 'Host it live',
    body: 'Run every stage, timer, reveal and team interaction from the facilitator view.',
  },
  {
    num: '04',
    title: 'Celebrate together',
    body: 'Bring the final leaderboard and podium to the big screen when the moment lands.',
  },
] as const

export function HowItWorks() {
  return (
    <section
      id="how"
      className="scroll-mt-20 border-t border-[var(--nm-border)] bg-[var(--nm-bg-surface)] py-16 lg:py-24"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-12">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="mkt-eyebrow justify-center">
            <span className="mkt-live-pulse" aria-hidden />
            From idea to applause
          </p>
          <h2 className="text-foreground font-display mt-3 text-3xl font-normal leading-[1.12] tracking-tight sm:text-4xl">
            Your event, live <span className="text-muted-foreground">in four simple moves.</span>
          </h2>
          <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
            Everything stays connected, from the first stage you build to the final winner reveal.
          </p>
        </Reveal>

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.num} delay={i}>
              <NeoCard className="flex h-full flex-col gap-3 p-6">
                <span className="mkt-step-num">{s.num}</span>
                <h3 className="text-foreground text-lg font-bold">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.body}</p>
              </NeoCard>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
