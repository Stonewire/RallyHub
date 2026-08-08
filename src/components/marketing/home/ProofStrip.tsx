const PROOF = [
  { strong: '~10 minutes', span: 'From new event to ready to run, once your games are built' },
  { strong: '6 ways to play', span: 'Photo · Video · Text · Quiz · Puzzles · Music bingo' },
  { strong: '3 synced live views', span: 'Facilitator · Room display · Player phones' },
  { strong: '1 continuous score', span: 'Every game feeds the same live leaderboard' },
] as const

export function ProofStrip() {
  return (
    <section className="mkt-proof" aria-label="RallyHub at a glance">
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:px-12">
        {PROOF.map((item) => (
          <div key={item.strong} className="space-y-1">
            <strong>{item.strong}</strong>
            <span>{item.span}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
