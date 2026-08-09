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
            No other platform does this.
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
            aspect="4 / 3.2"
            label="PHOTO: the physical kit on the host table, hands mid-handover, the order visible on a phone beside it"
            caption="The moment points become glue. The one picture no competitor can take."
          />
        </Reveal>
      </div>
    </section>
  )
}
