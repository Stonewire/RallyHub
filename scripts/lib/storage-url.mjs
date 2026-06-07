const BUCKET = 'game-assets'
const MARKER = `/storage/v1/object/public/${BUCKET}/`

/** Extract raw object path from a public storage URL (may need further decoding). */
export function pathFromPublicUrl(publicUrl) {
  if (!publicUrl?.trim()) return null
  try {
    const url = new URL(publicUrl.trim())
    const idx = url.pathname.indexOf(MARKER)
    if (idx === -1) return null
    return decodeURIComponent(url.pathname.slice(idx + MARKER.length))
  } catch {
    return null
  }
}

/** Build a correct public URL from the literal storage object path. */
export function publicUrlFromStoragePath(supabase, objectPath) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath)
  return data.publicUrl
}

export function hasDoubleExtension(name) {
  return /\.(mp3|m4a|wav|aac|flac|ogg)\.(mp3|m4a|wav|aac|flac|ogg)$/i.test(name)
}

export function hasEncodedPercent(name) {
  return /%25[0-9a-f]{2}/i.test(name) || /%20/i.test(name)
}

export function stripAudioExtension(filename) {
  return filename.replace(/\.(mp3|m4a|aac|wav|flac|ogg)$/i, '').trim()
}

/** Normalize a broken storage path segment to a clean filename with one extension. */
export function cleanCatalogFilename(filename) {
  let name = filename
  for (let i = 0; i < 3; i++) {
    const next = decodeURIComponent(name)
    if (next === name) break
    name = next
  }
  while (hasDoubleExtension(name)) {
    name = name.replace(/\.(mp3|m4a|aac|wav|flac|ogg)$/i, '')
  }
  return name.trim()
}

/** Derive a stable clean object path under org/catalog from a broken path. */
export function cleanObjectPath(objectPath) {
  const parts = objectPath.split('/')
  if (parts.length < 3) return objectPath
  const filename = parts[parts.length - 1]
  parts[parts.length - 1] = cleanCatalogFilename(filename)
  return parts.join('/')
}

export function extractUuidPrefix(filename) {
  const m = filename.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  )
  return m?.[1] ?? null
}

export { BUCKET }
