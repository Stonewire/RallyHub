import { ImageSlot } from './ImageSlot'
import { Reveal } from './Reveal'

const GAMES = [
  {
    title: 'Photo challenges',
    body: 'Send teams out with a brief. They bring back the proof.',
  },
  {
    title: 'Video challenges',
    body: 'Give teams a prompt worth acting out on camera.',
  },
  {
    title: 'Text challenges',
    body: 'Typed answers or multiple choice, right on their phone.',
  },
  {
    title: 'Live quizzes',
    body: 'Timed rounds, every team answering together, scored automatically.',
  },
  {
    title: 'Puzzles',
    body: 'Crosswords, word games and matching rounds for a change of pace.',
  },
  {
    title: 'Music bingo',
    body: 'Play the clips. Every team gets its own shuffled card.',
  },
] as const

export function MixedEventRun() {
  return (
    <section id="why" className="scroll-mt-20">
      <div className="mk-wrap mk-section">
        <Reveal className="grid gap-5" style={{ maxWidth: '46rem' }}>
          <h2 className="mk-h2">
            A real library of games. Mix them into one event, or run one alone.
          </h2>
          <p className="mk-lead mk-muted">
            Every format lives in the same app, on the same leaderboard, ready whenever your
            event needs it.
          </p>
        </Reveal>

        <div className="mk-games-grid">
          <Reveal as="ul" className="mk-games-list" aria-label="Game types available on RallyHub">
            {GAMES.map((game) => (
              <li key={game.title}>
                <h3>{game.title}</h3>
                <p>{game.body}</p>
              </li>
            ))}
          </Reveal>
          <Reveal delay={1} className="mk-games-side">
            <ImageSlot
              aspect="9 / 16"
              label="SCREENSHOTS: six real player-phone screens, one per game type, cycling"
              caption="Shot on a player's phone, mid-game. No mockups."
            />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
