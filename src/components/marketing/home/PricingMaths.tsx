import { Reveal } from './Reveal'

/** Worked example: 60 players. RallyHub Pro = €99 event + 7 extra teams × €10. */
const COMPARISON = [
  { label: 'RallyHub Pro', price: 169, note: '€99 event + 7 extra teams', us: true },
  { label: 'Per-player tools (€5 a head)', price: 300, note: 'Typical BYOD pricing', us: false },
  { label: 'iPad-per-team platforms', price: 660, note: '12 team devices at €55', us: false },
] as const

const MAX = Math.max(...COMPARISON.map((c) => c.price))

export function PricingMaths() {
  return (
    <section className="mkt-show scroll-mt-20">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <Reveal>
            <p className="mkt-eyebrow-light text-xs font-bold uppercase tracking-[0.05em]">
              The maths
            </p>
            <h2 className="font-sans mt-3 text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-4xl">
              Per-player pricing punishes you for growing.{' '}
              <span className="text-[var(--mkt-gold)]">So we do not use it.</span>
            </h2>
          </Reveal>
          <Reveal delay={1}>
            <p className="text-[color:var(--mkt-show-muted)] text-lg leading-relaxed">
              Most event platforms charge per head or per device, so your biggest events carry the
              biggest software bill. RallyHub charges per event. Here is a 60-player event, priced
              three ways.
            </p>
          </Reveal>
        </div>

        <Reveal delay={1} className="mt-12">
          <div className="grid gap-4" role="img" aria-label="Cost comparison for a 60-player event: RallyHub Pro 169 euros, per-player tools 300 euros, iPad-per-team platforms 660 euros">
            {COMPARISON.map((c) => (
              <div key={c.label} className="grid gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className="text-sm font-bold"
                    style={{ color: c.us ? 'var(--mkt-gold)' : 'var(--mkt-show-text)' }}
                  >
                    {c.label}
                  </p>
                  <p
                    className="text-xl font-extrabold tabular-nums sm:text-2xl"
                    style={{ color: c.us ? 'var(--mkt-gold)' : 'var(--mkt-show-text)' }}
                  >
                    €{c.price}
                  </p>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[rgb(250_247_242_/_0.08)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(c.price / MAX) * 100}%`,
                      background: c.us
                        ? 'var(--mkt-gold)'
                        : 'color-mix(in srgb, var(--mkt-show-text) 34%, transparent)',
                    }}
                  />
                </div>
                <p className="text-xs" style={{ color: 'var(--mkt-show-muted)' }}>
                  {c.note}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm font-semibold" style={{ color: 'var(--mkt-show-muted)' }}>
            The bigger your events get, the better our maths looks. All prices exclude VAT.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
