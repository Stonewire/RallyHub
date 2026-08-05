import { describe, expect, it } from 'vitest'

import { moveStage } from '@/lib/event-form-utils'
import type { EventStage } from '@/types/game-config'

function stage(id: string): EventStage {
  return { id, name: id, type: 'open', gameId: null, gameIds: [] }
}

const stages = [stage('a'), stage('b'), stage('c')]

describe('moveStage', () => {
  it('moves a stage later', () => {
    expect(moveStage(stages, 0, 1).map((s) => s.id)).toEqual(['b', 'a', 'c'])
  })

  it('moves a stage earlier', () => {
    expect(moveStage(stages, 2, -1).map((s) => s.id)).toEqual(['a', 'c', 'b'])
  })

  it('refuses to move past either end', () => {
    expect(moveStage(stages, 0, -1)).toBe(stages)
    expect(moveStage(stages, 2, 1)).toBe(stages)
  })

  it('keeps every stage exactly once', () => {
    const moved = moveStage(stages, 1, -1)
    expect(moved).toHaveLength(stages.length)
    expect([...moved].map((s) => s.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('leaves the original list untouched', () => {
    moveStage(stages, 0, 1)
    expect(stages.map((s) => s.id)).toEqual(['a', 'b', 'c'])
  })
})
