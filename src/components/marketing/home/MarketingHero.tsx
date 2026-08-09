import { ArrowRight, Check } from 'lucide-react'

import { ImageSlot } from './ImageSlot'
import { Reveal } from './Reveal'

export function MarketingHero() {
  return (
    <section id="top" className="mk-hero mk-dark">
      <div className="mk-wrap mk-hero-grid">
        <Reveal className="grid gap-7">
          <p className="mk-kicker">EVENT SOFTWARE FOR PEOPLE WHO RUN EVENTS</p>
          <h1 className="mk-display">
            Build the format once. <span className="accent">Tailor every event.</span>
          </h1>
          <p className="mk-lead mk-muted">
            RallyHub turns your game library into client-ready team events. Quests, quizzes,
            puzzles and music bingo on one leaderboard, run from one screen. Set-up for a new
            event: about 10 minutes.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a className="mk-btn" href="#contact">
              Book a demo
              <ArrowRight aria-hidden />
            </a>
            <a
              className="mk-btn mk-btn--ghost"
              href="https://demo.rallyhub.games"
              target="_blank"
              rel="noreferrer"
            >
              Watch a live event
            </a>
          </div>
          <div className="mk-microproof" aria-label="Product highlights">
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

        <Reveal delay={1}>
          <ImageSlot
            aspect="4 / 3.4"
            label="PHOTO: over the facilitator's shoulder — control screen sharp in front, the lit room reacting behind"
            caption="One person, one screen, sixty people mid-cheer. That is the whole job."
          />
        </Reveal>
      </div>
    </section>
  )
}
