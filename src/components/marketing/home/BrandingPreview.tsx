import { Camera } from 'lucide-react'
import { useState, type CSSProperties } from 'react'

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
    <section id="branding" className="scroll-mt-20 py-16 lg:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-14 lg:px-12">
        <Reveal>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.05em]">
            Per-event branding
          </p>
          <h2 className="text-foreground font-sans mt-3 text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-4xl">
            Every event, <span className="text-muted-foreground">customised.</span>
          </h2>
          <p className="text-muted-foreground mt-4 max-w-lg text-lg leading-relaxed">
            Upload a logo and colours for each event and every screen carries them. Run three
            events in a week and each one can look completely different. Want RallyHub’s name
            gone entirely? Branding removal is available as an option.
          </p>
          <div
            className="mt-8 grid gap-2"
            role="group"
            aria-label="Preview event colour palettes"
          >
            {ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className="mkt-palette-btn"
                aria-pressed={active === id}
                onClick={() => setActive(id)}
              >
                <span>{PALETTES[id].label}</span>
                <span className="mkt-palette-dots" aria-hidden>
                  <i style={{ background: PALETTES[id].a }} />
                  <i style={{ background: PALETTES[id].b }} />
                  <i style={{ background: PALETTES[id].c }} />
                </span>
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={1} className="mkt-brand-preview" aria-live="polite">
          <div className="mkt-custom-display" style={clientVars}>
            <div className="mkt-cd-head">
              <div className="mkt-client-mark">{p.mark}</div>
              <span>{p.eventName}</span>
            </div>
            <h3>Live leaderboard</h3>
            <div className="mkt-custom-row">
              <span>1</span>
              <i style={{ '--score': '92%' } as CSSProperties} />
              <b>340</b>
            </div>
            <div className="mkt-custom-row">
              <span>2</span>
              <i style={{ '--score': '74%' } as CSSProperties} />
              <b>275</b>
            </div>
            <div className="mkt-custom-row">
              <span>3</span>
              <i style={{ '--score': '58%' } as CSSProperties} />
              <b>215</b>
            </div>
          </div>
          <div className="mkt-brand-phone" style={clientVars} aria-hidden>
            <div className="mkt-brand-phone-screen">
              <small>City quest</small>
              <h4>Show us your team spirit</h4>
              <p>Take one brilliant team photo and submit it before the timer ends.</p>
              <div className="mkt-upload-box">
                <Camera aria-hidden />
              </div>
              <div className="mkt-upload-btn">Open camera</div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
