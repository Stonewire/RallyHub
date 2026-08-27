// Event media downloaded at join so challenge screens keep their pictures
// offline (FIX-ROUND-1 P3.2): game cover images, game background images, the
// photos embedded in game briefs (rich-text descriptions), and the event/org
// logos. All of these are Supabase Storage URLs rendered by plain <img> tags
// or CSS backgrounds, so with no connection they simply failed to load.
//
// Storage: its own Cache API cache. public/sw.js KEEPs this exact name in its
// activate cleanup and answers cross-origin image requests from it cache-first
// (falling through to the network), so the challenge screens keep their normal
// URLs and need no code changes to render offline.
//
// This cache is deliberately SEPARATE from the protected
// 'rallyhub-offline-blobs' queue cache: that one holds players' queued,
// not-yet-uploaded submissions with its own 150 MB cap, and nothing here may
// touch it. Losing this media cache only costs a re-download.

import { idbGet, idbSet } from './idb'
import { storageHeadroomBytes } from './blob-cache'

export const MEDIA_CACHE_NAME = 'rallyhub-offline-media-v1'

/** One image nobody needs offline more than queued submissions need space. */
export const MEDIA_SINGLE_FILE_BYTE_CAP = 10 * 1024 * 1024
/** Total cap for downloaded event media; far below the 150 MB blob queue cap. */
export const MEDIA_TOTAL_BYTE_CAP = 80 * 1024 * 1024
/** Stop adding media when device storage headroom drops this low, so media
 *  downloads never compete with queued submissions for the last space. */
const MIN_HEADROOM_BYTES = 50 * 1024 * 1024

const mediaKey = (eventId: string) => `media:${eventId}`

type StoredMediaIndex = { urls: string[]; savedAt: string }

const HTTP_URL = /^https?:\/\//i

/** src attributes of <img> tags in rich-text HTML (game briefs). The editor
 *  always writes quoted attributes, so quoted forms are the only ones parsed.
 *  data: URIs are skipped, they are inline and render offline already. */
export function extractImageUrlsFromHtml(html: string | null | undefined): string[] {
  if (!html) return []
  const urls: string[] = []
  const re = /<img\b[^>]*?\ssrc\s*=\s*(?:"([^"]+)"|'([^']+)')/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const url = match[1] ?? match[2]
    if (url && HTTP_URL.test(url)) urls.push(url)
  }
  return urls
}

/** The slice of the LiveEventBundle that carries media URLs. Structural so
 *  tests do not need full database rows. */
export type MediaBundleLike = {
  event: { logo_url?: string | null }
  organization?: {
    logo_url?: string | null
    logo_light_url?: string | null
    logo_dark_url?: string | null
  } | null
  games: {
    cover_url?: string | null
    description?: string | null
    config?: unknown
  }[]
}

/**
 * Every http(s) media URL the joined player's screens can show for this event:
 * event/org logos, then per game its cover, its background image and the
 * images embedded in its brief. Deduplicated, order stable. Quiz question
 * media is deliberately absent: quiz stages are online-only by design.
 */
export function collectBundleMediaUrls(bundle: MediaBundleLike): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  const add = (url: string | null | undefined) => {
    if (!url || !HTTP_URL.test(url) || seen.has(url)) return
    seen.add(url)
    urls.push(url)
  }

  add(bundle.event.logo_url)
  add(bundle.organization?.logo_url)
  add(bundle.organization?.logo_light_url)
  add(bundle.organization?.logo_dark_url)

  for (const game of bundle.games) {
    add(game.cover_url)
    const config = (game.config ?? {}) as { background_url?: string | null }
    add(config.background_url)
    for (const url of extractImageUrlsFromHtml(game.description)) add(url)
  }

  return urls
}

/** URLs cached for this event last time that the fresh collection no longer
 *  references (organiser removed or replaced an image), safe to delete. */
export function mediaUrlsToPrune(
  previousUrls: readonly string[],
  currentUrls: readonly string[],
): string[] {
  const current = new Set(currentUrls)
  return previousUrls.filter((url) => !current.has(url))
}

/** Whether one more file fits under the caps. Unknown sizes (0) always fit:
 *  the single-file cap only blocks files that DECLARE themselves oversized. */
export function shouldCacheMediaFile(sizeBytes: number, totalBytesSoFar: number): boolean {
  if (sizeBytes > MEDIA_SINGLE_FILE_BYTE_CAP) return false
  if (totalBytesSoFar + sizeBytes > MEDIA_TOTAL_BYTE_CAP) return false
  return true
}

function hasCache(): boolean {
  return typeof caches !== 'undefined'
}

function responseSize(res: Response): number {
  // Opaque (no-cors) responses hide their headers; count them as unknown.
  return Number(res.headers.get('content-length') ?? 0) || 0
}

/**
 * Download the event's media into the cache, pruning what the event no longer
 * references. Entirely best-effort and sequential (kind to event-venue radios):
 * a failed fetch or a full cache skips that file and the screen falls back to
 * loading it from the network like before. Already-cached URLs are not
 * re-fetched, so calling this again on reconnect is cheap.
 */
export async function downloadEventMedia(eventId: string, urls: string[]): Promise<void> {
  if (!hasCache()) return
  try {
    const cache = await caches.open(MEDIA_CACHE_NAME)

    // Prune per event, like the snapshot pattern: only URLs THIS event stored
    // before are removed, so a second event's media on the device is untouched.
    const previous = await idbGet<StoredMediaIndex>('content', mediaKey(eventId))
    for (const gone of mediaUrlsToPrune(previous?.urls ?? [], urls)) {
      try {
        await cache.delete(gone)
      } catch {
        // A lingering entry costs bytes, not correctness.
      }
    }
    await idbSet('content', mediaKey(eventId), {
      urls,
      savedAt: new Date().toISOString(),
    } satisfies StoredMediaIndex).catch(() => undefined)

    let totalBytes = 0
    for (const req of await cache.keys()) {
      const res = await cache.match(req)
      if (res) totalBytes += responseSize(res)
    }

    for (const url of urls) {
      if (await cache.match(url)) continue
      const headroom = await storageHeadroomBytes()
      if (headroom !== null && headroom < MIN_HEADROOM_BYTES) return
      let res: Response
      try {
        res = await fetch(url)
      } catch {
        try {
          // A brief-embedded image on a host without CORS: an opaque copy
          // still serves an <img> tag offline.
          res = await fetch(url, { mode: 'no-cors' })
        } catch {
          continue
        }
      }
      if (res.type !== 'opaque' && !res.ok) continue
      const size = responseSize(res)
      if (!shouldCacheMediaFile(size, totalBytes)) continue
      try {
        await cache.put(url, res)
        totalBytes += size
      } catch {
        // Quota or a mid-write eviction: stop adding, keep what we have.
        return
      }
    }
  } catch {
    // No Cache API (private mode): media simply stays online-only.
  }
}
