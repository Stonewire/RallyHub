import { describe, expect, it } from 'vitest'

import { youTubeEmbedUrl, youTubeVideoId } from '@/lib/video-embed'

describe('youTubeVideoId', () => {
  it('reads the id from every link shape organisers paste', () => {
    expect(youTubeVideoId('https://www.youtube.com/watch?v=RIveKVGw0fY')).toBe('RIveKVGw0fY')
    expect(youTubeVideoId('https://youtu.be/RIveKVGw0fY')).toBe('RIveKVGw0fY')
    expect(youTubeVideoId('https://m.youtube.com/watch?v=RIveKVGw0fY')).toBe('RIveKVGw0fY')
    expect(youTubeVideoId('https://www.youtube.com/shorts/RIveKVGw0fY')).toBe('RIveKVGw0fY')
    expect(youTubeVideoId('https://www.youtube.com/embed/RIveKVGw0fY')).toBe('RIveKVGw0fY')
  })

  it('leaves non-YouTube media alone', () => {
    expect(youTubeVideoId('https://cdn.example.com/clip.mp4')).toBeNull()
    expect(youTubeVideoId('not a url')).toBeNull()
    expect(youTubeVideoId(null)).toBeNull()
    expect(youTubeVideoId('')).toBeNull()
  })

  it('does not read a lookalike host as YouTube', () => {
    expect(youTubeVideoId('https://youtube.com.evil.example/watch?v=x')).toBeNull()
  })
})

describe('youTubeEmbedUrl', () => {
  it('builds a nocookie embed', () => {
    expect(youTubeEmbedUrl('https://www.youtube.com/watch?v=RIveKVGw0fY')).toBe(
      'https://www.youtube-nocookie.com/embed/RIveKVGw0fY?playsinline=1&rel=0',
    )
  })
  it('returns null when there is nothing to embed', () => {
    expect(youTubeEmbedUrl('https://cdn.example.com/clip.mp4')).toBeNull()
  })
})
