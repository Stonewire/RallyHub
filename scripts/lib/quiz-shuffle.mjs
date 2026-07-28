/**
 * Deterministic option shuffle, shared by the quiz seeder and the checker.
 *
 * Questions are written with the correct answer wherever it read most naturally,
 * which clusters it in the first two slots. Teams notice that within a round.
 * Shuffling on a hash of the question text spreads the answer evenly and gives
 * the same result every run, so re-seeding never reshuffles a live quiz.
 */
function hash(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function shuffleOptions(questionText, options, correctIndex) {
  let seed = hash(questionText)
  const next = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0
    return seed / 0x100000000
  }
  const order = options.map((option, i) => ({ option, i }))
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return {
    options: order.map((o) => o.option),
    correctIndex: order.findIndex((o) => o.i === correctIndex),
  }
}
