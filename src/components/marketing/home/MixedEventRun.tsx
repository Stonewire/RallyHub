import { Camera, ListChecks, Music4, Puzzle, Type, Video, type LucideIcon } from 'lucide-react'

import { Reveal } from './Reveal'

type GameKind = {
  icon: LucideIcon
  title: string
  body: string
}

const GAME_KINDS: GameKind[] = [
  {
    icon: Camera,
    title: 'Photo challenges',
    body: 'Send teams out with a brief. They bring back the proof.',
  },
  {
    icon: Video,
    title: 'Video challenges',
    body: 'Give teams a prompt worth acting out on camera.',
  },
  {
    icon: Type,
    title: 'Text challenges',
    body: 'Typed answers or multiple choice, right on their phone.',
  },
  {
    icon: ListChecks,
    title: 'Live quizzes',
    body: 'Timed rounds, every team answering together, scored automatically.',
  },
  {
    icon: Puzzle,
    title: 'Puzzles',
    body: 'Crosswords, word games and matching rounds for a change of pace.',
  },
  {
    icon: Music4,
    title: 'Music bingo',
    body: 'Play the clips. Every team gets its own shuffled card.',
  },
]

export function MixedEventRun() {
  return (
    <section id="why" className="mkt-show scroll-mt-20">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <Reveal>
            <p className="mkt-eyebrow-light text-xs font-bold uppercase tracking-[0.05em]">
              One platform, six ways to play
            </p>
            <h2 className="font-sans mt-3 text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-4xl lg:text-[2.8rem]">
              A real library of games.{' '}
              <span className="text-[var(--mkt-gold)]">Mix them into one event, or run one alone.</span>
            </h2>
          </Reveal>
          <Reveal delay={1}>
            <p className="text-[color:var(--mkt-show-muted)] text-lg leading-relaxed">
              Photo and video challenges, typed questions, live quizzes, puzzles, music bingo.
              Every format lives in the same app, on the same leaderboard, ready whenever your
              event needs it.
            </p>
          </Reveal>
        </div>

        <ul
          className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Game types available on RallyHub"
        >
          {GAME_KINDS.map((item, i) => (
            <Reveal as="li" key={item.title} delay={i}>
              <div className="mkt-run-card">
                <span className="mkt-run-icon">
                  <item.icon aria-hidden />
                </span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
