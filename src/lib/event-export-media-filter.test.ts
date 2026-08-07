import { describe, expect, it } from 'vitest'

import { isDownloadableMedia } from '@/lib/event-export'

/**
 * The 7 Aug 2026 export produced a pile of ~10KB "JPEGs" that opened as
 * nothing. Text submissions were queued for download, but their media_url is
 * the team's answer, not a URL, so the request fell through to the app's own
 * index.html and that HTML was saved under a .jpg name.
 */
describe('isDownloadableMedia', () => {
  const url = 'https://example.supabase.co/storage/v1/object/public/game-assets/a.jpg'

  it('keeps real photo and video submissions', () => {
    expect(isDownloadableMedia('photo', url)).toBe(true)
    expect(isDownloadableMedia('video', url.replace('.jpg', '.mp4'))).toBe(true)
  })

  it('never downloads a typed text answer', () => {
    expect(isDownloadableMedia('text', 'Toothpick')).toBe(false)
    expect(isDownloadableMedia('text', 'Paolo Camilleri')).toBe(false)
  })

  it('never downloads a chosen option id', () => {
    expect(isDownloadableMedia('text', 'a9309020-9693-475d-8531-7a31ca2f57ec')).toBe(false)
  })

  it('still skips quiz, bingo and puzzle submissions', () => {
    expect(isDownloadableMedia('quiz:q1', 'opt-1')).toBe(false)
    expect(isDownloadableMedia('puzzle', 'wordle:4')).toBe(false)
    expect(isDownloadableMedia('bingo', 'anything')).toBe(false)
  })

  it('skips a media submission whose url is missing or not a link', () => {
    expect(isDownloadableMedia('photo', null)).toBe(false)
    expect(isDownloadableMedia('photo', '')).toBe(false)
    expect(isDownloadableMedia('photo', '/local/path.jpg')).toBe(false)
  })
})
