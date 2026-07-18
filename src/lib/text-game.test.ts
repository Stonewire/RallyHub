import { describe, expect, it } from 'vitest'

import { isOpenStageSubmissionMediaType, puzzleSubmissionStatLabel } from './text-game'

describe('puzzle submission display', () => {
  it('counts puzzle submissions as open-stage submissions', () => {
    expect(isOpenStageSubmissionMediaType('puzzle')).toBe(true)
    expect(isOpenStageSubmissionMediaType('photo')).toBe(true)
    expect(isOpenStageSubmissionMediaType('bingo')).toBe(false)
  })

  it('labels each puzzle stat from the media_url', () => {
    expect(puzzleSubmissionStatLabel('wordle:1')).toBe('Solved in 1 guess')
    expect(puzzleSubmissionStatLabel('wordle:4')).toBe('Solved in 4 guesses')
    expect(puzzleSubmissionStatLabel('matching:7')).toBe('Matched in 7 attempts')
    expect(puzzleSubmissionStatLabel('crossword:95')).toBe('Solved in 1:35')
    expect(puzzleSubmissionStatLabel('unknown')).toBe('Puzzle complete')
  })
})
