import { ImageSlot } from './ImageSlot'
import { Reveal } from './Reveal'

const VIEWS = [
  {
    title: 'The host',
    body: 'Stages, timers, scoring and submissions in one facilitator view.',
  },
  {
    title: 'The room',
    body: 'Leaderboards, reveals and the final podium, projector ready.',
  },
  {
    title: 'The teams',
    body: 'Scan the QR, pick a team, play in the browser. No installs needed.',
  },
] as const

export function LiveViewsShowcase() {
  return (
    <section className="mk-roomband">
      <div className="mk-wrap mk-section">
        <Reveal>
          <ImageSlot
            aspect="21 / 9"
            label="PHOTO: one wide frame of a real room — big screen behind, facilitator laptop mid-ground, phones in players' hands"
            caption="Three synced views, one room, one photograph. The host, the big screen and every phone on the same beat."
          />
        </Reveal>
        <Reveal delay={1} className="mk-roomrow">
          {VIEWS.map((view) => (
            <div key={view.title}>
              <strong>{view.title}</strong>
              <p>{view.body}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
