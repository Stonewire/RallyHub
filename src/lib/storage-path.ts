const AUDIO_EXT = /\.(mp3|m4a|aac|wav|flac|ogg)$/i

/** Remove a trailing audio extension so callers can append exactly one. */
export function stripAudioExtension(filename: string): string {
  return filename.replace(AUDIO_EXT, '').trim()
}

/** Build a storage filename with a single extension (e.g. "Artist - Title.mp3"). */
export function audioStorageFilename(baseName: string, extension: string): string {
  const base = stripAudioExtension(baseName)
  const ext = extension.replace(/^\./, '')
  return `${base}.${ext}`
}

/** Sanitize one storage path segment (not URL-encoded). */
export function sanitizeStorageSegment(segment: string): string {
  return segment
    // eslint-disable-next-line no-control-regex -- deliberately stripping control chars from untrusted filenames
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[/\\]/g, '-')
    .trim()
}

/** Sanitize a full storage object path while preserving folder structure. */
export function sanitizeStoragePath(path: string): string {
  return path
    .split('/')
    .map((segment) => sanitizeStorageSegment(segment))
    .filter(Boolean)
    .join('/')
}
