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
