import { CheckCheck, MonitorSmartphone, SlidersHorizontal, type LucideIcon } from 'lucide-react'

import { Reveal } from './Reveal'

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: CheckCheck,
    title: 'Approve every submission yourself',
    body: 'Photos, videos and answers land in your queue. Nothing scores until you say it does.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Control what every screen shows',
    body: 'The big display, the leaderboard, every player phone: you decide what the room sees and when.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Full control, no restrictions',
    body: 'Jump between stages in any order, pause a team, replay a track, hold the reveal. It is your event to run.',
  },
]

export function FacilitatorShowcase() {
  return (
    <section id="facilitate" className="mkt-show scroll-mt-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:gap-14 lg:px-12 lg:py-24">
        <Reveal className="mkt-window order-2 lg:order-1" aria-label="Illustration of the RallyHub facilitator control room">
          <div className="mkt-chrome">
            <span className="mkt-dots">
              <i />
              <i />
              <i />
            </span>
            <span className="mkt-chrome-address">Live control room</span>
            <span aria-hidden />
          </div>
          <div className="mkt-fac-body">
            <aside className="mkt-fac-rail" aria-hidden>
              <div className="mkt-fac-event">
                <small>Now live</small>
                <strong>Summer Summit</strong>
              </div>
              <div className="mkt-stage-mini">01 · Quest</div>
              <div className="mkt-stage-mini">02 · Quiz</div>
              <div className="mkt-stage-mini active">03 · Music bingo</div>
              <div className="mkt-stage-mini">04 · Winners</div>
            </aside>
            <div className="mkt-fac-main">
              <div className="mkt-fac-toolbar">
                <span>Stage 03 · Golden Hits Bingo</span>
                <span className="mkt-fac-status">Event live</span>
              </div>
              <div className="mkt-fac-grid">
                <div className="mkt-display-preview">
                  <img
                    src="/marketing/rallyhub-display.jpg"
                    alt="RallyHub live audience display showing the event leaderboard"
                    loading="lazy"
                    width={1280}
                    height={720}
                  />
                  <div className="mkt-preview-caption">
                    <span>Audience display preview</span>
                    <span>Open full screen ↗</span>
                  </div>
                </div>
                <div className="mkt-fac-controls" aria-hidden>
                  <div className="mkt-timer-card">
                    <small>Stage timer</small>
                    <b>08:42</b>
                    <div className="mkt-timer-buttons">
                      <span>Pause</span>
                      <span>+ 1 min</span>
                    </div>
                  </div>
                  <div className="mkt-announce-card">
                    <small>Announcement</small>
                    <p>Send a message to every team.</p>
                    <span className="mkt-announce-btn">New message</span>
                  </div>
                </div>
              </div>
              <div className="mkt-submission-row" aria-hidden>
                <div className="mkt-submission-card">
                  <small>Team Orbit</small>
                  <strong>Photo challenge</strong>
                  <div className="mkt-submission-meta">
                    <span>Just now</span>
                    <span>Review →</span>
                  </div>
                </div>
                <div className="mkt-submission-card">
                  <small>Quiz scoring</small>
                  <strong>24 answers received</strong>
                  <div className="mkt-submission-meta">
                    <span>Round 2</span>
                    <span>Reveal →</span>
                  </div>
                </div>
                <div className="mkt-submission-card">
                  <small>Music bingo</small>
                  <strong>Next track ready</strong>
                  <div className="mkt-submission-meta">
                    <span>18 / 25</span>
                    <span>Play →</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={1} className="order-1 lg:order-2">
          <p className="mkt-eyebrow-light text-xs font-bold uppercase tracking-[0.05em]">
            The facilitator
          </p>
          <h2 className="font-sans mt-3 text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-4xl">
            Running the room is{' '}
            <span className="text-[var(--mkt-gold)]">the easy part.</span>
          </h2>
          <p className="text-[color:var(--mkt-show-muted)] mt-4 max-w-lg text-lg leading-relaxed">
            One screen controls everything: stages, timers, tracks, submissions, reveals, winners.
            The big screen keeps the room hyped. Player phones stay in sync on their own. You look
            calm because you are.
          </p>
          <ul className="mt-8 space-y-6">
            {FEATURES.map((f) => (
              <li key={f.title} className="mkt-feature">
                <span
                  className="mkt-feature-icon"
                  style={{
                    background: 'rgb(250 247 242 / 0.08)',
                    color: 'var(--mkt-show-text)',
                  }}
                >
                  <f.icon aria-hidden />
                </span>
                <div>
                  <h3 style={{ color: 'var(--mkt-show-text)' }}>{f.title}</h3>
                  <p style={{ color: 'var(--mkt-show-muted)' }}>{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
