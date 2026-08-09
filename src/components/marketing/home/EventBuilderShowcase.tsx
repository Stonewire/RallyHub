import { ImageSlot } from './ImageSlot'
import { Reveal } from './Reveal'

/* A real three-step sequence, so the numbers earn their place. */
const STEPS = [
  {
    title: 'Design',
    body: 'Build your challenges, quizzes and playlists once. They live in your library as assets, not one-offs.',
  },
  {
    title: 'Adapt',
    body: 'New client, new event: pick the games, set the stages, drop in a logo and colours. About 10 minutes.',
  },
  {
    title: 'Deliver',
    body: 'Run it live from one screen. Last week’s format becomes next week’s event, not next week’s rebuild.',
  },
] as const

export function EventBuilderShowcase() {
  return (
    <section id="product" className="mk-sandband scroll-mt-20">
      <div className="mk-wrap mk-section">
        <Reveal className="grid gap-5" style={{ maxWidth: '44rem' }}>
          <h2 className="mk-h2">Design. Adapt. Deliver.</h2>
          <p className="mk-lead mk-muted">
            Prep time is money you do not bill for. RallyHub gives most of it back: every client
            event after the first is assembly, not construction.
          </p>
        </Reveal>

        <div className="mk-steps-grid">
          <Reveal as="ol" className="mk-steps">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="mk-step-num" aria-hidden>
                  {i + 1}
                </span>
                <div>
                  <h3 className="mk-h3">{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </Reveal>
          <Reveal delay={1}>
            <ImageSlot
              aspect="16 / 10"
              label="SCREENSHOT: the real event builder — stage list on the left, event branding panel on the right"
              caption="The actual builder. Stages, games and branding in one screen, saved as you go."
            />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
