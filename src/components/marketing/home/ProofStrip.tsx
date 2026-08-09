const PROOF = [
  { strong: '~10 min', span: 'From new event to ready to run, once your games are built' },
  { strong: '6 ways to play', span: 'Photo, video, text, quiz, puzzles, music bingo' },
  { strong: '3 live views', span: 'Facilitator, room display, player phones, always in sync' },
  { strong: '1 score', span: 'Every game feeds the same live leaderboard' },
] as const

export function ProofStrip() {
  return (
    <section className="mk-yellowband" aria-label="RallyHub at a glance">
      <div className="mk-wrap mk-proof">
        {PROOF.map((item) => (
          <div key={item.strong}>
            <strong>{item.strong}</strong>
            <span>{item.span}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
