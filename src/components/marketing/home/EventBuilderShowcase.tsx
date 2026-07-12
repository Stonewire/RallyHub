import {
  Camera,
  Copy,
  LayoutGrid,
  Monitor,
  Music4,
  Palette,
  Play,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { Reveal } from './Reveal'

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: LayoutGrid,
    title: 'One visual timeline',
    body: 'Arrange quests, quizzes, bingo and breaks in the exact order you want to host them.',
  },
  {
    icon: Copy,
    title: 'Reuse what works',
    body: 'Keep your best games in a library and duplicate a whole event instead of rebuilding it.',
  },
  {
    icon: Palette,
    title: 'Brand it before it goes live',
    body: 'Set the event logo and colours once, then carry them across every live surface.',
  },
]

const STAGES: { icon: LucideIcon; title: string; meta: string; time: string }[] = [
  { icon: Camera, title: 'City Quest', meta: '8 challenges · Host review', time: '20 min' },
  { icon: Trophy, title: 'Round the World Quiz', meta: '3 rounds · Auto scoring', time: '25 min' },
  { icon: Music4, title: 'Golden Hits Bingo', meta: '25 tracks · Unique cards', time: '30 min' },
  { icon: Trophy, title: 'Final leaderboard', meta: 'Winner reveal · Podium', time: 'Live' },
]

export function EventBuilderShowcase() {
  return (
    <section id="product" className="scroll-mt-20 py-16 lg:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-14 lg:px-12">
        <Reveal>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.05em]">
            The event builder
          </p>
          <h2 className="text-foreground font-display mt-3 text-3xl font-normal leading-[1.12] tracking-tight sm:text-4xl">
            Build the run. <span className="text-muted-foreground">Not the plumbing.</span>
          </h2>
          <p className="text-muted-foreground mt-4 max-w-lg text-lg leading-relaxed">
            Create reusable games, arrange the stages, set timers and scoring, add your music, then
            duplicate the whole event for next time.
          </p>
          <ul className="mt-8 space-y-6">
            {FEATURES.map((f) => (
              <li key={f.title} className="mkt-feature">
                <span className="mkt-feature-icon">
                  <f.icon aria-hidden />
                </span>
                <div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={1} className="mkt-window" aria-label="Illustration of the RallyHub event builder">
          <div className="mkt-chrome">
            <span className="mkt-dots">
              <i />
              <i />
              <i />
            </span>
            <span className="mkt-chrome-address">app.rallyhub.games / events / summer-summit</span>
            <span aria-hidden />
          </div>
          <div className="mkt-builder-body">
            <aside className="mkt-builder-side" aria-hidden>
              <div className="mkt-mini-brand">
                <span className="mkt-mini-mark">R</span>RallyHub
              </div>
              <span className="mkt-side-link">
                <LayoutGrid aria-hidden />
                Dashboard
              </span>
              <span className="mkt-side-link active">
                <Play aria-hidden />
                Events
              </span>
              <span className="mkt-side-link">
                <Sparkles aria-hidden />
                Games
              </span>
              <span className="mkt-side-link">
                <Users aria-hidden />
                Team
              </span>
              <span className="mkt-side-link">
                <SlidersHorizontal aria-hidden />
                Settings
              </span>
            </aside>
            <div className="mkt-builder-main">
              <div className="mkt-builder-head">
                <div>
                  <small>Event builder</small>
                  <h3>Summer Summit 2026</h3>
                </div>
                <span className="mkt-save-badge">Saved</span>
              </div>
              <div className="mkt-builder-grid">
                <div className="mkt-panel">
                  <div className="mkt-panel-label">
                    Event stages <span>Drag to reorder</span>
                  </div>
                  {STAGES.map((s) => (
                    <div key={s.title} className="mkt-stage-row">
                      <span className="mkt-stage-row-icon">
                        <s.icon aria-hidden />
                      </span>
                      <div>
                        <strong>{s.title}</strong>
                        <small>{s.meta}</small>
                      </div>
                      <b>{s.time}</b>
                    </div>
                  ))}
                  <div className="mkt-add-stage">+ Add another stage</div>
                </div>
                <aside className="mkt-panel" aria-hidden>
                  <div className="mkt-panel-label">Event branding</div>
                  <div className="mkt-logo-drop">
                    Client logo
                    <br />
                    Drop or upload
                  </div>
                  <div className="mkt-swatch-line">
                    <span>Primary</span>
                    <i className="mkt-swatch" style={{ background: '#382064' }} />
                  </div>
                  <div className="mkt-swatch-line">
                    <span>Secondary</span>
                    <i className="mkt-swatch" style={{ background: '#a73c7c' }} />
                  </div>
                  <div className="mkt-swatch-line">
                    <span>Accent</span>
                    <i className="mkt-swatch" style={{ background: '#f37e64' }} />
                  </div>
                  <div className="mkt-builder-note">
                    <Monitor aria-hidden />
                    Preview the palette across display and phones.
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
