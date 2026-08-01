import { describe, expect, it } from 'vitest'

import { moveTargets, questionsInRound, removeRound } from '@/components/games/quiz-round-edits'
import type { GameConfig } from '@/types/game-config'

const config: GameConfig = {
  rounds: [
    { id: 'r1', name: 'Round 1', questionIds: ['q2', 'q1'] },
    { id: 'r2', name: 'Round 2', questionIds: ['q3'] },
  ],
  questions: [
    { id: 'q1', text: 'one', answers: [], correctAnswerId: '', roundId: 'r1' },
    { id: 'q2', text: 'two', answers: [], correctAnswerId: '', roundId: 'r1' },
    { id: 'q3', text: 'three', answers: [], correctAnswerId: '', roundId: 'r2' },
  ],
}

describe('questionsInRound', () => {
  it('uses the round order, not the questions array order', () => {
    expect(questionsInRound(config, 'r1').map((q) => q.id)).toEqual(['q2', 'q1'])
  })

  it('counts a question the round forgot to list', () => {
    // A stale questionIds must never hide a question from the delete warning.
    const stale: GameConfig = {
      ...config,
      rounds: [{ id: 'r1', name: 'Round 1', questionIds: [] }],
    }
    expect(questionsInRound(stale, 'r1').map((q) => q.id).sort()).toEqual(['q1', 'q2'])
  })
})

describe('removeRound', () => {
  it('moves the questions when a target is given', () => {
    const next = removeRound(config, 'r1', 'r2')
    expect(next.rounds?.map((r) => r.id)).toEqual(['r2'])
    expect(next.questions).toHaveLength(3)
    expect(next.questions?.every((q) => q.roundId === 'r2')).toBe(true)
    expect(next.rounds?.[0].questionIds).toEqual(['q3', 'q2', 'q1'])
  })

  it('deletes the questions when no target is given', () => {
    const next = removeRound(config, 'r1', null)
    expect(next.rounds?.map((r) => r.id)).toEqual(['r2'])
    expect(next.questions?.map((q) => q.id)).toEqual(['q3'])
  })

  it('deletes rather than moving when the target no longer exists', () => {
    const next = removeRound(config, 'r1', 'nope')
    expect(next.questions?.map((q) => q.id)).toEqual(['q3'])
  })

  it('leaves an empty round removal harmless', () => {
    const empty: GameConfig = { ...config, questions: [] }
    const next = removeRound(empty, 'r1', null)
    expect(next.rounds?.map((r) => r.id)).toEqual(['r2'])
    expect(next.questions).toEqual([])
  })
})

describe('moveTargets', () => {
  it('offers every round except the one being deleted', () => {
    expect(moveTargets(config, 'r1').map((r) => r.id)).toEqual(['r2'])
  })
})
