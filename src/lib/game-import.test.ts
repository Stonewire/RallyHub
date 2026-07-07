import { describe, expect, it } from 'vitest'

import { buildGameImportPlan, buildGameImportTemplate, parseCsv } from '@/lib/game-import'

describe('parseCsv', () => {
  it('parses quoted fields with commas, escaped quotes and newlines', () => {
    const rows = parseCsv('a,"b, c","say ""hi""","line1\nline2"\r\nx,y,z,')
    expect(rows).toEqual([
      ['a', 'b, c', 'say "hi"', 'line1\nline2'],
      ['x', 'y', 'z', ''],
    ])
  })

  it('drops fully empty rows and strips a BOM', () => {
    const rows = parseCsv('﻿Name,Type\r\n\r\nGame,PHOTO\r\n,,\r\n')
    expect(rows).toEqual([
      ['Name', 'Type'],
      ['Game', 'PHOTO'],
    ])
  })
})

describe('buildGameImportPlan', () => {
  const header = 'Name,Type,Description,Group,Point type,Points,Time limit (seconds),Question,Answers,Correct answer'

  it('imports the original hand-made sheet format (5 columns)', () => {
    const csv = [
      'Name,Type,Description,Point type,Points',
      'SOAK YOUR OPPONENT,VIDEO,Soak someone.,Static,100',
      'Movie Scene,PHOTO,Recreate the pose.,Range,50-300',
    ].join('\n')
    const plan = buildGameImportPlan(parseCsv(csv))
    expect(plan.errors).toEqual([])
    expect(plan.games).toHaveLength(2)
    expect(plan.games[0]).toMatchObject({
      name: 'SOAK YOUR OPPONENT',
      type: 'video',
      points_type: 'static',
      points_static: 100,
    })
    expect(plan.games[1]).toMatchObject({
      type: 'photo',
      points_type: 'range',
      points_min: 50,
      points_max: 300,
    })
  })

  it('parses the shipped template end to end', () => {
    const plan = buildGameImportPlan(parseCsv(buildGameImportTemplate()))
    expect(plan.errors).toEqual([])
    // 6 template rows, but the two Office Quiz rows merge into one game.
    expect(plan.games).toHaveLength(5)
    expect(plan.groupNames.sort()).toEqual(['Outdoor games', 'Quizzes'])
  })

  it('merges quiz rows by name into one game with questions', () => {
    const csv = [
      header,
      'Pub Quiz,QUIZ,My quiz,Quizzes,Static,10,20,Capital of France?,Madrid|Paris,Paris',
      'Pub Quiz,QUIZ,,,,,,Red planet?,Venus|Mars|Jupiter,Mars',
    ].join('\n')
    const plan = buildGameImportPlan(parseCsv(csv))
    expect(plan.errors).toEqual([])
    expect(plan.games).toHaveLength(1)
    const quiz = plan.games[0]
    expect(quiz.config.timer_seconds).toBe(20)
    expect(quiz.config.questions).toHaveLength(2)
    const q1 = quiz.config.questions![0]
    expect(q1.answers.map((a) => a.text)).toEqual(['Madrid', 'Paris'])
    expect(q1.answers.find((a) => a.id === q1.correctAnswerId)?.text).toBe('Paris')
  })

  it('builds typed and multiple-choice text games', () => {
    const csv = [
      header,
      'Riddle,TEXT,desc,,Static,50,,,piano|a piano,',
      'Pick One,TEXT,desc,,Static,50,,,Red|Yellow|Green,Yellow',
    ].join('\n')
    const plan = buildGameImportPlan(parseCsv(csv))
    expect(plan.errors).toEqual([])
    expect(plan.games[0].config).toMatchObject({
      text_answer_mode: 'type_text',
      text_correct_answers: ['piano', 'a piano'],
    })
    const mc = plan.games[1].config
    expect(mc.text_answer_mode).toBe('choose_answer')
    expect(mc.text_options).toHaveLength(3)
    expect(mc.text_options!.find((o) => o.id === mc.text_correct_answer_id)?.text).toBe('Yellow')
  })

  it('maps video time limit and group', () => {
    const csv = [header, 'Clip,VIDEO,desc,Outdoor,Static,100,45,,,'].join('\n')
    const plan = buildGameImportPlan(parseCsv(csv))
    expect(plan.games[0].config.max_video_duration_seconds).toBe(45)
    expect(plan.games[0].groupName).toBe('Outdoor')
    expect(plan.groupNames).toEqual(['Outdoor'])
  })

  it('reports helpful row errors and keeps the good rows', () => {
    const csv = [
      header,
      'Good,PHOTO,desc,,Static,100,,,,',
      ',PHOTO,missing name,,Static,100,,,,',
      'Bingo Game,MUSIC_BINGO,not importable,,Static,100,,,,',
      'Bad Points,PHOTO,desc,,Static,lots,,,,',
      'Mismatch,PHOTO,desc,,Static,50-100,,,,',
      'Quiz No Correct,QUIZ,desc,,Static,10,,Question?,A|B,C',
      'No Answers,TEXT,desc,,Static,10,,,,',
    ].join('\n')
    const plan = buildGameImportPlan(parseCsv(csv))
    expect(plan.games).toHaveLength(1)
    expect(plan.errors).toHaveLength(6)
    expect(plan.errors[0]).toMatch(/Row 3.*name/)
    expect(plan.errors[1]).toMatch(/Row 4.*music bingo/i)
    expect(plan.errors[2]).toMatch(/Row 5.*Points/)
    expect(plan.errors[3]).toMatch(/Row 6.*Static.*range/)
    expect(plan.errors[4]).toMatch(/Row 7.*Correct answer/)
    expect(plan.errors[5]).toMatch(/Row 8.*Answers/)
  })

  it('rejects a file without the header', () => {
    const plan = buildGameImportPlan(parseCsv('just,some,cells'))
    expect(plan.games).toEqual([])
    expect(plan.errors[0]).toMatch(/header/)
  })
})
