import { useState } from 'react'

import { DeviceMock } from './DeviceMock'
import { Reveal } from './Reveal'

/** Real events built in RallyHub, each with that client's own logo and palette. */
const CLIENTS = [
  {
    id: 'tiltwork',
    label: 'Tiltwork Events',
    colors: ['#002775', '#000000', '#1548EF'],
  },
  {
    id: 'lumenwild',
    label: 'Lumenwild Events',
    colors: ['#28143F', '#F8BA9C', '#BFE12F'],
  },
  {
    id: 'northline',
    label: 'Northline Events',
    colors: ['#112644', '#E6EAF1', '#FE4A3F'],
  },
] as const

type ClientId = (typeof CLIENTS)[number]['id']

export function BrandingPreview() {
  const [active, setActive] = useState<ClientId>('tiltwork')
  const current = CLIENTS.find((c) => c.id === active) ?? CLIENTS[0]

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
          <div className="mt-8 grid gap-2.5" role="group" aria-label="Preview client branding">
            {CLIENTS.map((client) => (
              <button
                key={client.id}
                type="button"
                className="mk-palette-btn"
                aria-pressed={active === client.id}
                onMouseEnter={() => setActive(client.id)}
                onFocus={() => setActive(client.id)}
                onClick={() => setActive(client.id)}
              >
                <span>{client.label}</span>
                <span className="mk-palette-dots" aria-hidden>
                  {client.colors.map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={1} aria-live="polite">
          <DeviceMock
            activeId={active}
            screens={CLIENTS.map((c) => ({
              id: c.id,
              base: `/marketing/app-client-${c.id}`,
              alt: `The same RallyHub challenge board wearing ${c.label} branding: their logo and their colours on every tile`,
            }))}
            widths={[500, 900]}
            sizes="(max-width: 1024px) 78vw, 380px"
          />
          <p className="mk-caption">
            {current.label}. Same event, same screen, their brand.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
