import { ImageSlot } from './ImageSlot'
import { Reveal } from './Reveal'

export function StoreShowcase() {
  return (
    <section id="store" className="mk-yellowband scroll-mt-20">
      <div className="mk-wrap mk-section mk-store-grid">
        <Reveal>
          <h2 className="mk-h2">Digital points. Physical consequences.</h2>
          <p className="mk-lead" style={{ marginTop: '1.1rem', color: 'color-mix(in srgb, var(--mk-ink) 78%, var(--mk-yellow))' }}>
            Teams earn points on their phones and spend them in the event store on real items in
            the room: build materials, power-ups, sabotage cards, whatever your format calls for.
            It is the bridge between the screen and the table.
          </p>
          <ul className="mk-store-points" aria-label="How the event store works">
            <li>Points from any game become store budget for the team.</li>
            <li>Orders land on the facilitator screen for handover in the room.</li>
            <li>Purchases feed physical build and challenge stages.</li>
          </ul>
          <p className="mk-pull" style={{ marginTop: '2rem' }}>
            Win the photo round, buy the good glue, build the better tower.
          </p>
        </Reveal>

        <Reveal delay={1}>
          <ImageSlot
            aspect="3 / 2"
            label="Store handover"
            photo={{
              base: '/marketing/store-handover',
              widths: [800, 1200],
              alt: 'A facilitator hands a RallyHub-banded build kit across the host table while the order shows on a player’s phone',
              sizes: '(max-width: 1024px) 100vw, 520px',
            }}
            caption="The moment points become glue. Digital scoring, physical payoff."
          />
        </Reveal>
      </div>
    </section>
  )
}
