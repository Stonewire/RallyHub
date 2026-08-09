import { ArrowRight, Camera } from 'lucide-react'

import { Reveal } from './Reveal'

export function MarketingHero() {
  return (
    <section id="top" className="mk-hero mk-dark">
      {/* Full-bleed background photo slot: over the facilitator's shoulder, room reacting. */}
      <div className="mk-hero-bg" aria-hidden>
        <span className="mk-hero-bg-label">
          <Camera aria-hidden />
          PHOTO, full bleed: over the facilitator&rsquo;s shoulder, the lit room reacting behind
        </span>
      </div>

      <div className="mk-wrap mk-hero-inner">
        <Reveal className="grid gap-6">
          <h1 className="mk-display">
            Build the format once. <span className="accent">Tailor every event.</span>
          </h1>
          <p className="mk-lead mk-muted">Stronger Teams, one game at a time.</p>
          <div>
            <a className="mk-btn" href="#contact">
              Book a demo
              <ArrowRight aria-hidden />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
