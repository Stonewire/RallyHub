import { describe, expect, it } from 'vitest'

import { youtubeEmbedUrl } from './youtube'

describe('youtubeEmbedUrl', () => {
  it('accepts the shapes an organiser can paste', () => {
    const embed = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(embed)
    expect(youtubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(embed)
    expect(youtubeEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(embed)
    expect(youtubeEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(embed)
  })

  it('keeps a start time', () => {
    expect(youtubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ?t=42s')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=42',
    )
  })

  it('returns null for anything that is not YouTube', () => {
    expect(youtubeEmbedUrl('https://example.com/clip.mp4')).toBeNull()
    expect(youtubeEmbedUrl('not a url')).toBeNull()
    expect(youtubeEmbedUrl('')).toBeNull()
    expect(youtubeEmbedUrl(null)).toBeNull()
  })
})
