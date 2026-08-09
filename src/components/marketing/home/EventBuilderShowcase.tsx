import { ImageSlot } from './ImageSlot'
import { Reveal } from './Reveal'

/* A real three-step sequence, so the numbers earn their place. */
const STEPS = [
  {
    title: 'Design',
    body: 'Build your challenges, quizzes and playlists once. They live in your library as assets.',
  },
  {
    title: 'Adapt',
    body: 'New client: pick the games, set the stages, drop in a logo and colours. About 10 minutes.',
  },
  {
    title: 'Deliver',
    body: 'Run it live from one screen. Last week’s format becomes next week’s event.',
  },
] as const

export function EventBuilderShowcase() {
  return (
    <section id="product" className="mk-sandband scroll-mt-20">
      <div className="mk-wrap mk-section">
        <div className="mk-builder-head">
          <Reveal>
            <h2 className="mk-h2">Design. Adapt. Deliver.</h2>
          </Reveal>
          <Reveal delay={1}>
            <p className="mk-lead mk-muted">
              Prep time is money you do not bill for. RallyHub gives most of it back: every client
              event after the first is assembly, not construction.
            </p>
          </Reveal>
        </div>

        <Reveal as="ol" className="mk-steps-row">
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

        <Reveal delay={1} className="mk-wide-shot">
          <ImageSlot
            /* Matches the screenshot exactly so object-fit never crops the app chrome. */
            aspect="4370 / 2392"
            label="Event builder"
            photo={{
              base: '/marketing/app-event-designer',
              widths: [1000, 1700],
              alt: 'The RallyHub event builder: event settings, client branding with logo and colours, teams, and the stage list with 18 drag-to-reorder challenges',
              sizes: '(max-width: 1200px) 100vw, 1200px',
            }}
            caption="The real builder. Branding on the right, stages below, saved as you go."
          />
        </Reveal>
      </div>
    </section>
  )
}
