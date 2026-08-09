import { ArrowRight } from 'lucide-react'

import { RALLYHUB_BOOKING_URL } from '@/constants/contact'

import { Reveal } from './Reveal'

export function MarketingHero() {
  return (
    <section id="top" className="mk-hero mk-dark">
      <picture className="mk-hero-bg">
        <source
          type="image/webp"
          srcSet="/marketing/hero-event-operator-1000.webp 1000w, /marketing/hero-event-operator-1600.webp 1600w"
          sizes="100vw"
        />
        <img
          src="/marketing/hero-event-operator-1600.jpg"
          srcSet="/marketing/hero-event-operator-1000.jpg 1000w, /marketing/hero-event-operator-1600.jpg 1600w"
          sizes="100vw"
          alt="A facilitator watches her RallyHub control screen while the room behind her cheers a winning team"
          fetchPriority="high"
          decoding="async"
        />
      </picture>

      <div className="mk-wrap mk-hero-inner">
        <Reveal className="grid gap-6">
          <h1 className="mk-display">
            <span>Build the format once.</span>
            <span className="accent">Tailor every event.</span>
          </h1>
          <p className="mk-lead mk-muted">Stronger Teams, one game at a time.</p>
          <div>
            <a className="mk-btn" href={RALLYHUB_BOOKING_URL} target="_blank" rel="noreferrer">
              Book a demo
              <ArrowRight aria-hidden />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
