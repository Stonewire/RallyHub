import { useState, type CSSProperties } from 'react'

import { ImageSlot } from './ImageSlot'
import { Reveal } from './Reveal'

type PaletteId = 'sunset' | 'ocean' | 'citrus'

const PALETTES: Record<
  PaletteId,
  { label: string; eventName: string; mark: string; a: string; b: string; c: string }
> = {
  sunset: { label: 'Sunset social', eventName: 'Monarch Summer Social', mark: 'M', a: '#382064', b: '#a73c7c', c: '#f37e64' },
  ocean: { label: 'Ocean offsite', eventName: 'Bluewater Offsite', mark: 'B', a: '#0b3042', b: '#087e8b', c: '#6dd6c7' },
  citrus: { label: 'Citrus summit', eventName: 'Evergreen Summit', mark: 'E', a: '#263a29', b: '#6d8d45', c: '#d4dc65' },
}

const ORDER: PaletteId[] = ['sunset', 'ocean', 'citrus']

export function BrandingPreview() {
  const [active, setActive] = useState<PaletteId>('sunset')
  const p = PALETTES[active]
  const clientVars = {
    '--client-a': p.a,
    '--client-b': p.b,
    '--client-c': p.c,
  } as CSSProperties

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
          <div className="mk-custom-display" style={clientVars}>
            <div className="mk-cd-head">
              <span className="mk-client-mark">{p.mark}</span>
              <span>{p.eventName}</span>
            </div>
            <h3>Live leaderboard</h3>
            <div className="mk-custom-row">
              <span>1</span>
              <i style={{ '--score': '92%' } as CSSProperties} />
              <b>340</b>
            </div>
            <div className="mk-custom-row">
              <span>2</span>
              <i style={{ '--score': '74%' } as CSSProperties} />
              <b>275</b>
            </div>
            <div className="mk-custom-row">
              <span>3</span>
              <i style={{ '--score': '58%' } as CSSProperties} />
              <b>215</b>
            </div>
          </div>
          <ImageSlot
            className="mk-brand-slot"
            aspect="16 / 6"
            label="SCREENSHOTS: three real display screens in three different event palettes, side by side"
            caption="Same platform, three real events, three completely different looks."
          />
        </Reveal>
      </div>
    </section>
  )
}
