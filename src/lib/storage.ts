import { sanitizeStoragePath } from '@/lib/storage-path'
import { supabase } from '@/lib/supabase'

export async function uploadAsset(
  bucket: 'game-assets' | 'organization-logos',
  path: string,
  file: File,
): Promise<string> {
  const objectPath = sanitizeStoragePath(path)
  const { error } = await supabase.storage.from(bucket).upload(objectPath, file, {
    upsert: true,
    contentType: file.type || undefined,
  })
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath)
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
