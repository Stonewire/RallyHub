import { Reveal } from './Reveal'

/** Worked example: a 12-device event (~60 players). RallyHub Pro = €99 event + 7 extra devices × €10. */
const COMPARISON = [
  { label: 'RallyHub Pro', price: 169, note: '€99 event + 7 extra devices, 12 total', us: true },
  { label: 'Per-player tools (€5 a head)', price: 300, note: '60 players at €5 a head', us: false },
  { label: 'iPad-per-team platforms', price: 660, note: '12 devices supplied at €55 each', us: false },
] as const

const MAX = Math.max(...COMPARISON.map((c) => c.price))

export function PricingMaths() {
  return (
    <section className="mk-dark">
      <div className="mk-wrap mk-section">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <Reveal>
            <h2 className="mk-h2">
              Per-player pricing punishes you for growing.{' '}
              <span style={{ color: 'var(--mk-yellow)' }}>So we do not use it.</span>
            </h2>
          </Reveal>
          <Reveal delay={1}>
            <p className="mk-lead mk-muted">
              RallyHub charges per event: 5 devices included, then €10 for each one after that.
              Tablets you hand out or phones people bring along, it makes no difference. Here is a
              12-device event, priced three ways.
            </p>
          </Reveal>
        </div>

        <Reveal
          delay={1}
          className="mk-maths"
          role="img"
          aria-label="Cost comparison for a 12-device, roughly 60-player event: RallyHub Pro 169 euros, per-player tools 300 euros, iPad-per-team platforms 660 euros"
        >
          {COMPARISON.map((c) => (
            <div key={c.label} className="mk-maths-row">
              <div
                className="mk-maths-head"
                style={{ color: c.us ? 'var(--mk-yellow)' : 'var(--mk-ivory-text)' }}
              >
                <span>{c.label}</span>
                <span className="mk-maths-price">€{c.price}</span>
              </div>
              <div className="mk-maths-track">
                <div
                  className="mk-maths-fill"
                  style={{
                    width: `${(c.price / MAX) * 100}%`,
                    background: c.us
                      ? 'var(--mk-yellow)'
                      : 'color-mix(in srgb, var(--mk-ivory-text) 32%, transparent)',
                  }}
                />
              </div>
              <span className="mk-maths-note">{c.note}</span>
            </div>
          ))}
          <p className="mk-maths-note" style={{ marginTop: '0.8rem' }}>
            The bigger your events get, the better our maths looks. Device, not player: a shared
            tablet and a personal phone count the same. All prices exclude VAT.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
