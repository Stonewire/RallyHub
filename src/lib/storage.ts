import { supabase } from '@/lib/supabase'

function encodePath(path: string) {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

export async function uploadAsset(
  bucket: 'game-assets' | 'organization-logos',
  path: string,
  file: File,
): Promise<string> {
  const encodedPath = encodePath(path)
  const { error } = await supabase.storage.from(bucket).upload(encodedPath, file, {
    upsert: true,
    contentType: file.type || undefined,
  })
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(encodedPath)
  return data.publicUrl
}

/** Extract object path from a Supabase public storage URL. */
export function publicUrlStoragePath(
  publicUrl: string,
  bucket: 'game-assets' | 'organization-logos',
): string | null {
  try {
    const url = new URL(publicUrl)
    const marker = `/storage/v1/object/public/${bucket}/`
    const idx = url.pathname.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(url.pathname.slice(idx + marker.length))
  } catch {
    return null
  }
}

export async function deleteStorageObjects(
  bucket: 'game-assets' | 'organization-logos',
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(bucket).remove(paths)
  if (error) throw error
}
