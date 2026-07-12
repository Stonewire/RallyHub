const PROOF = [
  { strong: '5 ways to play', span: 'Photo · Video · Text · Quiz · Music bingo' },
  { strong: '3 synced live views', span: 'Facilitator · Room display · Team phones' },
  { strong: '1 continuous score', span: 'Every stage feeds the same live leaderboard' },
  { strong: 'Your event, your look', span: 'Logo and colour palette on every screen' },
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
