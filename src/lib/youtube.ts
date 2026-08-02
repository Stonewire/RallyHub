/**
 * Turns a YouTube link into an embeddable one.
 *
 * Organisers paste whatever the address bar or the Share button gave them, so
 * watch links, short links, Shorts and already-embedded URLs all have to work.
 * Anything that is not YouTube returns null, which the caller treats as a
 * direct video file.
 */
export function youtubeEmbedUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  let id: string | null = null

  if (host === 'youtu.be') {
    id = url.pathname.slice(1)
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else if (url.pathname.startsWith('/embed/')) id = url.pathname.slice('/embed/'.length)
    else if (url.pathname.startsWith('/shorts/')) id = url.pathname.slice('/shorts/'.length)
    else if (url.pathname.startsWith('/live/')) id = url.pathname.slice('/live/'.length)
  }

  id = id?.split('/')[0]?.trim() ?? null
  if (!id || !/^[\w-]{6,}$/.test(id)) return null

  // Start time survives the conversion: a question may point at one moment.
  const start = url.searchParams.get('t') ?? url.searchParams.get('start')
  const seconds = start ? Number(start.replace(/s$/, '')) : NaN
  const query = Number.isFinite(seconds) && seconds > 0 ? `?start=${Math.floor(seconds)}` : ''
  return `https://www.youtube-nocookie.com/embed/${id}${query}`
}
