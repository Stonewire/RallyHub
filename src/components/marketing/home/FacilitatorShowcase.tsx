import { ImageSlot } from './ImageSlot'
import { Reveal } from './Reveal'

const FEATURES = [
  {
    title: 'Approve every submission yourself',
    body: 'Photos, videos and answers land in your queue. Nothing scores until you say it does.',
  },
  {
    title: 'Control what every screen shows',
    body: 'The big display, the leaderboard, every player phone: you decide what the room sees and when.',
  },
  {
    title: 'Full control, no restrictions',
    body: 'Jump between stages in any order, pause a team, replay a track, hold the reveal. It is your event to run.',
  },
] as const

export function FacilitatorShowcase() {
  return (
    <section id="facilitate" className="mk-dark scroll-mt-20">
      <div className="mk-wrap mk-section">
        <div className="mk-steps-grid" style={{ alignItems: 'start' }}>
          <Reveal>
            <ImageSlot
              aspect="16 / 11"
              label="SCREENSHOT: the live control room on a laptop in a real venue — stage tabs, timer, submissions queue"
              caption="The facilitator screen during a real event. Every control, one place."
            />
          </Reveal>
          <Reveal delay={1}>
            <h2 className="mk-h2">
              Running the room is <span style={{ color: 'var(--mk-yellow)' }}>the easy part.</span>
            </h2>
            <p className="mk-lead mk-muted" style={{ marginTop: '1.1rem' }}>
              One screen controls everything. The big screen keeps the room hyped, player phones
              stay in sync on their own. You look calm because you are.
            </p>
            <ul className="mk-featlist">
              {FEATURES.map((f) => (
                <li key={f.title}>
                  <h3 className="mk-h3">{f.title}</h3>
                  <p>{f.body}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
