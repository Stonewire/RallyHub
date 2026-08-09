import { useState } from 'react'

import { ImageSlot } from './ImageSlot'
import { Reveal } from './Reveal'

type PaletteId = 'sunset' | 'ocean' | 'citrus'

const PALETTES: Record<PaletteId, { label: string; a: string; b: string; c: string }> = {
  sunset: { label: 'Sunset social', a: '#382064', b: '#a73c7c', c: '#f37e64' },
  ocean: { label: 'Ocean offsite', a: '#0b3042', b: '#087e8b', c: '#6dd6c7' },
  citrus: { label: 'Citrus summit', a: '#263a29', b: '#6d8d45', c: '#d4dc65' },
}

const ORDER: PaletteId[] = ['sunset', 'ocean', 'citrus']

export function BrandingPreview() {
  const [active, setActive] = useState<PaletteId>('sunset')

  return (
    <section id="branding" className="scroll-mt-20">
      <div className="mk-wrap mk-section mk-brand-grid">
        <Reveal>
          <h2 className="mk-h2">Every event, customised.</h2>
          <p className="mk-lead mk-muted" style={{ marginTop: '1.1rem' }}>
            Upload a logo and colours for each event and every screen carries them. Run three
            events in a week and each one can look completely different. Want RallyHub’s name gone
            entirely? Branding removal is available as an option.
          </p>
          <div
            className="mt-8 grid gap-2.5"
            role="group"
            aria-label="Preview event colour palettes"
          >
            {ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className="mk-palette-btn"
                aria-pressed={active === id}
                onClick={() => setActive(id)}
              >
                <span>{PALETTES[id].label}</span>
                <span className="mk-palette-dots" aria-hidden>
                  <i style={{ background: PALETTES[id].a }} />
                  <i style={{ background: PALETTES[id].b }} />
                  <i style={{ background: PALETTES[id].c }} />
                </span>
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={1} aria-live="polite">
          <ImageSlot
            key={active}
            aspect="9 / 13"
            label={`Player screen in the ${PALETTES[active].label} palette`}
            photo={{
              base: `/marketing/app-brand-${active}`,
              widths: [420, 760],
              alt: `The same RallyHub quest board on a player's phone, wearing the ${PALETTES[active].label} event colours`,
              sizes: '(max-width: 1024px) 80vw, 420px',
            }}
            caption="The same event, the same screen, three different clients. This is what the players see."
          />
        </Reveal>
      </div>
    </section>
  )
}
