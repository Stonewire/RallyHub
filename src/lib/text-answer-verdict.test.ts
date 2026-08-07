import { describe, expect, it } from 'vitest'

import {
  expectedTextAnswerLabel,
  parseTextGameConfig,
  textAnswerVerdict,
} from '@/lib/text-game'
import type { Tables } from '@/types/helpers'

/**
 * Real shapes from the 7 Aug 2026 Camilleri event: typed-answer games carry
 * the editor's leftover default options AND a stale correct-option pointer.
 * Reading the wrong field for the mode is what printed "Answer 1" instead of
 * the real answer.
 */
function game(config: Record<string, unknown>): Pick<Tables<'games'>, 'config'> {
  return { config } as Pick<Tables<'games'>, 'config'>
}

const OPT_A = { id: 'opt-a', text: 'Spain' }
const OPT_B = { id: 'opt-b', text: 'Italy' }

const typedWithLeftovers = game({
  text_answer_mode: 'type_text',
  text_correct_answers: ['Toothpick'],
  text_options: [
    { id: 'leftover-1', text: 'Answer 1' },
    { id: 'leftover-2', text: 'Answer 2' },
  ],
  text_correct_answer_id: 'leftover-1',
})

const chooseGame = game({
  text_answer_mode: 'choose_answer',
  text_options: [OPT_A, OPT_B],
  text_correct_answer_id: OPT_B.id,
  // Leftover from a previous typed configuration; must be ignored.
  text_correct_answers: ['Spain'],
})

describe('expectedTextAnswerLabel', () => {
  it('reads typed answers even when leftover options exist', () => {
    expect(expectedTextAnswerLabel(typedWithLeftovers)).toBe('Toothpick')
  })

  it('reads the chosen option, ignoring leftover typed answers', () => {
    expect(expectedTextAnswerLabel(chooseGame)).toBe('Italy')
  })

  it('admits when a multiple-choice game has no correct answer set', () => {
    const unset = game({ text_answer_mode: 'choose_answer', text_options: [OPT_A, OPT_B] })
    // Never silently designate the first option as correct.
    expect(parseTextGameConfig(unset.config).correctAnswerId).toBe('')
    expect(expectedTextAnswerLabel(unset)).toBeNull()
  })
})

describe('textAnswerVerdict', () => {
  it('matches the chosen option by id', () => {
    expect(textAnswerVerdict(chooseGame, OPT_B.id)).toBe('correct')
    expect(textAnswerVerdict(chooseGame, OPT_A.id)).toBe('wrong')
  })

  it('matches typed answers, forgiving surrounding spaces', () => {
    expect(textAnswerVerdict(typedWithLeftovers, '  Toothpick ')).toBe('correct')
    expect(textAnswerVerdict(typedWithLeftovers, 'Napkin')).toBe('wrong')
  })

  it('flags a case-only difference rather than hiding it', () => {
    // The automatic marker counts this as wrong, so the facilitator must see it.
    expect(textAnswerVerdict(typedWithLeftovers, 'toothpick')).toBe('close')
  })

  it('stays unknown when the game has nothing to compare against', () => {
    const judged = game({ text_answer_mode: 'type_text', text_correct_answers: [] })
    expect(textAnswerVerdict(judged, 'anything')).toBe('unknown')
  })
})
