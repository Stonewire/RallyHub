export type ParsedAudioFilename = {
  artist: string
  title: string
  confidence: number
}

const JUNK_PATTERNS = [
  /\b(official\s*(music\s*)?video|lyrics?|audio|hd|4k|8k|1080p|720p)\b/gi,
  /\b(limited\s*edition|deluxe|remaster(ed)?|bonus\s*track)\b/gi,
  /\b\d{4}\b/g,
  /[\[\(][^\]\)]*[\]\)]/g,
]

function cleanPart(s: string): string {
  let x = s.trim()
  for (const p of JUNK_PATTERNS) {
    x = x.replace(p, ' ')
  }
  return x.replace(/\s+/g, ' ').replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim()
}

/** Parse "Artist - Title.mp3" style names; returns confidence 0–1. */
export function parseAudioFilename(filename: string): ParsedAudioFilename {
  const base = filename.replace(/\.(mp3|m4a|aac|wav|flac|ogg)$/i, '').trim()
  if (!base) {
    return { artist: 'Unknown', title: filename, confidence: 0 }
  }

  const separators = [' - ', ' – ', ' — ', ' _ ', '_-_', '-']
  for (const sep of separators) {
    if (base.includes(sep)) {
      const [a, ...rest] = base.split(sep)
      const title = rest.join(sep)
      const artist = cleanPart(a)
      const cleanTitle = cleanPart(title)
      if (artist && cleanTitle) {
        return {
          artist,
          title: cleanTitle,
          confidence: sep === ' - ' ? 0.75 : 0.55,
        }
      }
    }
  }

  const feat = base.match(/^(.+?)\s+(?:feat\.?|ft\.?)\s+(.+)$/i)
  if (feat) {
    return {
      artist: cleanPart(feat[1]),
      title: cleanPart(feat[2]),
      confidence: 0.6,
    }
  }

  return {
    artist: 'Unknown',
    title: cleanPart(base) || base,
    confidence: 0.25,
  }
}
