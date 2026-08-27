import { describe, expect, it } from 'vitest'

import {
  MEDIA_SINGLE_FILE_BYTE_CAP,
  MEDIA_TOTAL_BYTE_CAP,
  collectBundleMediaUrls,
  extractImageUrlsFromHtml,
  mediaUrlsToPrune,
  shouldCacheMediaFile,
} from './media-cache'

const storage = (path: string) => `https://example.supabase.co/storage/v1/object/public/${path}`

describe('extractImageUrlsFromHtml', () => {
  it('finds double- and single-quoted img srcs', () => {
    const html =
      `<p>Find the statue</p>` +
      `<img src="${storage('briefs/statue.jpg')}" alt="">` +
      `<img class="wide" src='${storage('briefs/map.png')}'>`
    expect(extractImageUrlsFromHtml(html)).toEqual([
      storage('briefs/statue.jpg'),
      storage('briefs/map.png'),
    ])
  })

  it('skips data URIs and empty/missing html', () => {
    expect(extractImageUrlsFromHtml('<img src="data:image/png;base64,AAAA">')).toEqual([])
    expect(extractImageUrlsFromHtml('')).toEqual([])
    expect(extractImageUrlsFromHtml(null)).toEqual([])
    expect(extractImageUrlsFromHtml(undefined)).toEqual([])
  })

  it('ignores src attributes on other tags', () => {
    expect(
      extractImageUrlsFromHtml(`<video src="${storage('clips/a.mp4')}"></video>`),
    ).toEqual([])
  })
})

describe('collectBundleMediaUrls', () => {
  it('gathers logos, covers, backgrounds and brief images, deduplicated', () => {
    const cover = storage('covers/one.jpg')
    const shared = storage('shared/logo-and-brief.png')
    const urls = collectBundleMediaUrls({
      event: { logo_url: shared },
      organization: {
        logo_url: storage('org/logo.png'),
        logo_light_url: storage('org/logo-light.png'),
        logo_dark_url: null,
      },
      games: [
        {
          cover_url: cover,
          description: `<img src="${shared}">`,
          config: { background_url: storage('backgrounds/one.jpg') },
        },
        // Same cover on a second game must not repeat.
        { cover_url: cover, description: null, config: null },
      ],
    })
    expect(urls).toEqual([
      shared,
      storage('org/logo.png'),
      storage('org/logo-light.png'),
      cover,
      storage('backgrounds/one.jpg'),
    ])
  })

  it('drops null, empty and non-http values', () => {
    const urls = collectBundleMediaUrls({
      event: { logo_url: null },
      organization: null,
      games: [
        {
          cover_url: '',
          description: '<img src="data:image/gif;base64,AA">',
          config: { background_url: 'blob:https://app/abc' },
        },
      ],
    })
    expect(urls).toEqual([])
  })

  it('handles a bundle with no organization and config as plain Json', () => {
    const urls = collectBundleMediaUrls({
      event: { logo_url: storage('events/logo.png') },
      games: [{ cover_url: storage('covers/two.jpg'), config: 'not-an-object' }],
    })
    expect(urls).toEqual([storage('events/logo.png'), storage('covers/two.jpg')])
  })
})

describe('mediaUrlsToPrune', () => {
  it('returns previously stored urls the event no longer references', () => {
    expect(mediaUrlsToPrune(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c'])
  })

  it('returns nothing when the sets match or there was no previous index', () => {
    expect(mediaUrlsToPrune(['a'], ['a'])).toEqual([])
    expect(mediaUrlsToPrune([], ['a', 'b'])).toEqual([])
  })
})

describe('shouldCacheMediaFile', () => {
  it('accepts ordinary images and unknown (0) sizes', () => {
    expect(shouldCacheMediaFile(2 * 1024 * 1024, 0)).toBe(true)
    expect(shouldCacheMediaFile(0, MEDIA_TOTAL_BYTE_CAP)).toBe(true)
  })

  it('rejects a single oversized file', () => {
    expect(shouldCacheMediaFile(MEDIA_SINGLE_FILE_BYTE_CAP + 1, 0)).toBe(false)
  })

  it('rejects a file that would push the cache past the total cap', () => {
    expect(shouldCacheMediaFile(1024, MEDIA_TOTAL_BYTE_CAP - 512)).toBe(false)
    expect(shouldCacheMediaFile(1024, MEDIA_TOTAL_BYTE_CAP - 1024)).toBe(true)
  })
})
