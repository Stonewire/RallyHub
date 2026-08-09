import { useState } from 'react'

import { DeviceMock } from './DeviceMock'
import { Reveal } from './Reveal'

const GAMES = [
  {
    id: 'photo',
    title: 'Photo challenges',
    body: 'Send teams out with a brief. They bring back the proof.',
    alt: 'A photo challenge on a tablet: the brief, a reference image and a Take photo button',
  },
  {
    id: 'video',
    title: 'Video challenges',
    body: 'Give teams a prompt worth acting out on camera.',
    alt: 'A video challenge on a tablet: a lip sync battle brief and a Take video button',
  },
  {
    id: 'text',
    title: 'Text challenges',
    body: 'Typed answers or multiple choice, on the app’s own keyboard.',
    alt: 'A text challenge on a tablet: a question, a typed answer and the in-app number keyboard',
  },
  {
    id: 'quiz',
    title: 'Live quizzes',
    body: 'Timed rounds, every team answering together, scored automatically.',
    alt: 'A live quiz question on a tablet with four answers and a change-answer countdown',
  },
  {
    id: 'puzzle',
    title: 'Puzzles',
    body: 'Crosswords, word games and matching rounds for a change of pace.',
    alt: 'A crossword puzzle on a tablet with clues, a hint button and the in-app keyboard',
  },
  {
    id: 'bingo',
    title: 'Music bingo',
    body: 'Play the clips. Every team gets its own shuffled card.',
    alt: 'A music bingo card on a tablet with correct, wrong and missed tracks marked',
  },
] as const

type GameId = (typeof GAMES)[number]['id']

export function MixedEventRun() {
  const [active, setActive] = useState<GameId>('photo')
  const current = GAMES.find((g) => g.id === active) ?? GAMES[0]

  return (
    <section id="why" className="scroll-mt-20">
      <div className="mk-wrap mk-section">
        <Reveal className="grid gap-5" style={{ maxWidth: '46rem' }}>
          <h2 className="mk-h2">
            A real library of games. Mix them into one event, or run one alone.
          </h2>
          <p className="mk-lead mk-muted">
            Every format lives in the same app, on the same leaderboard, ready whenever your
            event needs it. Hover a format to see what your teams get.
          </p>
        </Reveal>

        <div className="mk-games-grid">
          <Reveal as="ul" className="mk-games-list" aria-label="Game types available on RallyHub">
            {GAMES.map((game) => (
              <li key={game.id} data-active={game.id === active}>
                <button
                  type="button"
                  className="mk-game-btn"
                  aria-pressed={game.id === active}
                  onMouseEnter={() => setActive(game.id)}
                  onFocus={() => setActive(game.id)}
                  onClick={() => setActive(game.id)}
                >
                  <h3>{game.title}</h3>
                  <p>{game.body}</p>
                </button>
              </li>
            ))}
          </Reveal>

          <Reveal delay={1} className="mk-games-side" aria-live="polite">
            <DeviceMock
              activeId={active}
              screens={GAMES.map((g) => ({
                id: g.id,
                base: `/marketing/app-game-${g.id}`,
                alt: g.alt,
              }))}
              widths={[500, 900]}
              sizes="(max-width: 1024px) 78vw, 380px"
            />
            <p className="mk-caption">{current.title} as your teams see them, on a tablet or their own phone.</p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
