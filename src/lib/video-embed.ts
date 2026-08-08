/**
 * YouTube links cannot play in a native <video> tag: the player showed a dead
 * black box at the 8 Aug test. Anything from YouTube goes into an embed
 * iframe; anything else (uploaded .mp4 files) stays a native video.
 */
export function youTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^www\.|^m\./, '')
  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0]
    return id || null
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (parsed.pathname === '/watch') return parsed.searchParams.get('v')
    const m = parsed.pathname.match(/^\/(embed|shorts|live)\/([^/]+)/)
    if (m) return m[2]
  }
  return null
}

export function youTubeEmbedUrl(url: string | null | undefined): string | null {
  const id = youTubeVideoId(url)
  if (!id) return null
  // nocookie host: no tracking consent question inside a live event screen.
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?playsinline=1&rel=0`
}
