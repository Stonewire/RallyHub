import { Camera, Coffee, ListChecks, Music4, type LucideIcon } from 'lucide-react'

import { Reveal } from './Reveal'

type StageKind = {
  kind: string
  icon: LucideIcon
  title: string
  body: string
  tags: string[]
}

const STAGE_KINDS: StageKind[] = [
  {
    kind: 'Quest stage',
    icon: Camera,
    title: 'The free-roam board',
    body: 'A grid of photo, video, text and puzzle challenges. Teams pick their own path and their own pace; you approve submissions as they land.',
    tags: ['Photo', 'Video', 'Text', 'Puzzles'],
  },
  {
    kind: 'Quiz stage',
    icon: ListChecks,
    title: 'Lock-step rounds',
    body: 'Start the question, watch every team answer at once, reveal together. Timed and scored automatically.',
    tags: ['Timed rounds', 'Auto-scored'],
  },
  {
    kind: 'Bingo stage',
    icon: Music4,
    title: 'Music bingo',
    body: 'You play the clips. Every team gets its own shuffled card. The whole room sings the chorus.',
    tags: ['Your playlist', 'Unique cards'],
  },
  {
    kind: 'In between',
    icon: Coffee,
    title: 'Breaks and the reveal',
    body: 'A pizza break with a countdown, then the two-step podium reveal when the room is ready for it.',
    tags: ['Countdown', 'Podium'],
  },
]

export function MixedEventRun() {
  return (
    <section id="why" className="mkt-show scroll-mt-20">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <Reveal>
            <p className="mkt-eyebrow-light text-xs font-bold uppercase tracking-[0.05em]">
              One continuous experience
            </p>
            <h2 className="font-sans mt-3 text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-4xl lg:text-[2.8rem]">
              One event, built from stages.{' '}
              <span className="text-[var(--mkt-gold)]">You hold the remote.</span>
            </h2>
          </Reveal>
          <Reveal delay={1}>
            <p className="text-[color:var(--mkt-show-muted)] text-lg leading-relaxed">
              Mix free-roam quest boards, lock-step quiz rounds, a music bingo singalong and a
              proper break into one event. You switch the whole room between stages from the
              facilitator screen, in whatever order the night needs, and every point lands on the
              same leaderboard.
            </p>
          </Reveal>
        </div>

        <ul
          className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="The kinds of stages in a RallyHub event"
        >
          {STAGE_KINDS.map((item, i) => (
            <Reveal as="li" key={item.title} delay={i}>
              <div className="mkt-run-card">
                <span className="mkt-run-num">
                  <i />
                  {item.kind}
                </span>
                <span className="mkt-run-icon">
                  <item.icon aria-hidden />
                </span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <div className="mkt-run-tags">
                  {item.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
