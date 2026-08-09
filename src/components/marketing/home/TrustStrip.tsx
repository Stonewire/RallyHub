import { Reveal } from './Reveal'

const ITEMS = [
  {
    title: 'GDPR first',
    body: 'Built in the EU, for EU events.',
  },
  {
    title: 'Players never create accounts',
    body: 'Join with a link or QR code. Play. Leave. No profiles, no app-store logins.',
  },
  {
    title: 'Runs anywhere',
    body: 'A web app: play in the browser on any device, or install it straight from the browser on your own event tablets.',
  },
  {
    title: 'Your data is yours',
    body: 'Branding, game libraries and event history stay in your workspace.',
  },
] as const

export function TrustStrip() {
  return (
    <section>
      <div className="mk-wrap mk-section" style={{ paddingBlock: 'clamp(3rem, 6vw, 4.5rem)' }}>
        <Reveal>
          <h2 className="mk-h2" style={{ fontSize: 'clamp(1.5rem, 2.4vw, 2rem)' }}>
            Boring where it should be boring.
          </h2>
        </Reveal>
        <div className="mk-trust">
          {ITEMS.map((item, i) => (
            <Reveal key={item.title} delay={i}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
