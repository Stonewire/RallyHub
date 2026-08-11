import { describe, expect, it } from 'vitest'

import { buildEventChecklist, parseChecklistState } from '@/lib/event-checklist'

describe('buildEventChecklist', () => {
  it('groups the same item across sources and sums per-team, then multiplies by teams', () => {
    const rows = buildEventChecklist(
      [
        { kind: 'game', label: 'City Hunt', items: ['Torch', 'Rope'] },
        { kind: 'game', label: 'Night Trail', items: ['torch'] }, // case-insensitive match
        { kind: 'store', label: 'Puzzle Box', items: ['Answer sheet'] },
      ],
      4,
    )

    const torch = rows.find((r) => r.key === 'torch')
    expect(torch?.perTeam).toBe(2)
    expect(torch?.total).toBe(8) // 2 per team × 4 teams
    expect(torch?.sources).toHaveLength(2)
    expect(torch?.name).toBe('Torch') // first-seen casing kept

    const rope = rows.find((r) => r.key === 'rope')
    expect(rope?.perTeam).toBe(1)
    expect(rope?.total).toBe(4)

    const sheet = rows.find((r) => r.key === 'answer sheet')
    expect(sheet?.sources[0].kind).toBe('store')
  })

  it('dedupes within a single source so a repeat cannot inflate per-team', () => {
    const rows = buildEventChecklist(
      [{ kind: 'game', label: 'A', items: ['pen', 'Pen', ' pen '] }],
      3,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].perTeam).toBe(1)
    expect(rows[0].total).toBe(3)
  })

  it('ignores blank tags and floors/clamps the team count', () => {
    const rows = buildEventChecklist([{ kind: 'game', label: 'A', items: ['pen', '', '  '] }], -2)
    expect(rows[0].total).toBe(0)
  })
})

describe('parseChecklistState', () => {
  it('keeps ticks saved for the current team count', () => {
    const checked = parseChecklistState({ teamCount: 4, checked: { torch: true, rope: false } }, 4)
    expect(checked).toEqual({ torch: true })
  })

  it('drops all ticks when the team count changed', () => {
    const checked = parseChecklistState({ teamCount: 4, checked: { torch: true } }, 6)
    expect(checked).toEqual({})
  })

  it('is safe on malformed input', () => {
    expect(parseChecklistState(null, 4)).toEqual({})
    expect(parseChecklistState('nope', 4)).toEqual({})
    expect(parseChecklistState({ checked: { a: true } }, 4)).toEqual({})
  })
})
