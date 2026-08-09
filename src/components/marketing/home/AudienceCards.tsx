import { RALLYHUB_BOOKING_URL } from '@/constants/contact'

import { Reveal } from './Reveal'

export function AudienceCards() {
  return (
    <section className="mk-sandband">
      <div className="mk-wrap mk-section">
        <Reveal style={{ maxWidth: '40rem' }}>
          <h2 className="mk-h2">Not an agency? Still your kind of party.</h2>
        </Reveal>

        <div className="mk-aud-grid">
          <Reveal className="mk-aud mk-aud--coal">
            <span className="mk-chip mk-chip--yellow">Companies</span>
            <h3>Run your own team day</h3>
            <p>
              Build it yourself with the same tools the pros use, or grab a ready-made format and
              go. No event-planning degree required.
            </p>
            <a
              className="mk-link"
              href={RALLYHUB_BOOKING_URL}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--mk-yellow)' }}
            >
              Book a demo
            </a>
          </Reveal>

          <Reveal delay={1} className="mk-aud mk-aud--outline">
            <span className="mk-chip">Venues + hosts</span>
            <h3>Quiz night, every Thursday</h3>
            <p>
              Music bingo on Fridays too. Set it up once, rebrand it never, run it weekly from a
              phone.
            </p>
            <a className="mk-link" href={RALLYHUB_BOOKING_URL} target="_blank" rel="noreferrer">
              Book a demo
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
