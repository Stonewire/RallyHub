import { ArrowRight, Camera, ListChecks, Music4, Trophy, type LucideIcon } from 'lucide-react'
import { Fragment } from 'react'

import { Reveal } from './Reveal'

type RunStage = {
  stage: string
  icon: LucideIcon
  title: string
  body: string
  tags: string[]
}

const RUN: RunStage[] = [
  {
    stage: 'Stage 01',
    icon: Camera,
    title: 'Team quest',
    body: 'Get teams moving with creative photo, video and text challenges.',
    tags: ['Photo', 'Video', 'Text'],
  },
  {
    stage: 'Stage 02',
    icon: ListChecks,
    title: 'Live quiz',
    body: 'Run timed rounds, reveal the answers and score every team automatically.',
    tags: ['Rounds', 'Timers'],
  },
  {
    stage: 'Stage 03',
    icon: Music4,
    title: 'Music bingo',
    body: 'Play the clips, reveal the tracks and give every team its own shuffled card.',
    tags: ['Audio clips', 'Unique cards'],
  },
  {
    stage: 'Finale',
    icon: Trophy,
    title: 'Winner reveal',
    body: 'Build the suspense, reveal the podium and give the room its final cheer.',
    tags: ['Podium', 'Celebration'],
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
            <h2 className="font-display mt-3 text-3xl font-normal leading-[1.12] tracking-tight sm:text-4xl lg:text-[2.9rem]">
              Stop stitching the fun together{' '}
              <span className="text-[var(--mkt-gold)]">across different apps.</span>
            </h2>
          </Reveal>
          <Reveal delay={1}>
            <p className="text-[color:var(--mkt-show-muted)] text-lg leading-relaxed">
              Start with a photo quest. Move into timed quiz rounds. Turn up the music for bingo.
              Reveal the final podium, all without asking teams to switch links, apps or
              leaderboards.
            </p>
          </Reveal>
        </div>

        <ol
          className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch lg:gap-2"
          aria-label="Example mixed-format RallyHub event"
        >
          {RUN.map((item, i) => (
            <Fragment key={item.title}>
              <Reveal as="li" delay={i}>
                <div className="mkt-run-card">
                  <span className="mkt-run-num">
                    <i />
                    {item.stage}
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
              {i < RUN.length - 1 ? (
                <li className="hidden items-center justify-center lg:flex" aria-hidden>
                  <ArrowRight className="mkt-run-arrow size-5" />
                </li>
              ) : null}
            </Fragment>
          ))}
        </ol>
      </div>
    </section>
  )
}
