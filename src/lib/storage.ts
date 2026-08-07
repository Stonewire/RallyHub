import {
  inferUploadMediaKind,
  type UploadMediaKind,
  validateAttachmentUpload,
  validateUploadFileSize,
} from '@/lib/upload-limits'
import { sanitizeStoragePath } from '@/lib/storage-path'
import { supabase } from '@/lib/supabase'
import type { SupportTicketAttachment } from '@/types/database'

export async function uploadAsset(
  bucket: 'game-assets' | 'organization-logos' | 'user-avatars',
  path: string,
  file: File,
  options?: { mediaKind?: UploadMediaKind },
): Promise<string> {
  const kind =
    options?.mediaKind ??
    (bucket === 'organization-logos'
      ? 'logo'
      : bucket === 'user-avatars'
        ? 'avatar'
        : inferUploadMediaKind(file))
  const sizeError = validateUploadFileSize(file, kind)
  if (sizeError) throw new Error(sizeError)

  const objectPath = sanitizeStoragePath(path)
  const { error } = await supabase.storage.from(bucket).upload(objectPath, file, {
    upsert: true,
    contentType: file.type || undefined,
  })
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath)
  return data.publicUrl
}

/** A participant upload authorized before the file is sent to Storage. */
export type MintedParticipantUpload = {
  token: string
  /** Storage object path Supabase expects for uploadToSignedUrl. */
  path: string
  /** Public URL the object will have once uploaded. */
  publicUrl: string
  /** Full signed upload URL, for the progress-reporting XHR path. */
  signedUrl?: string
}

/**
 * P0-2b: anon storage RLS can't see the join token (storage-api doesn't forward
 * it), so a plain anon upload can't be scoped to "this participant's own event."
 * This mints a signed upload URL server-side (where the join token IS verifiable),
 * scoped to exactly one path.
 *
 * Split out from the upload itself so callers can authorize early, while a
 * participant is framing a photo/video, instead of adding that network round trip
 * to the submit path.
 */
export async function mintParticipantUpload(
  eventId: string,
  path: string,
): Promise<MintedParticipantUpload> {
  const objectPath = sanitizeStoragePath(path)

  const { data: mint, error: mintError } = await supabase.functions.invoke<{
    signedUrl: string
    token: string
    path: string
  }>('mint-storage-upload-url', {
    body: { eventId, path: objectPath },
  })
  if (mintError) {
    let message = mintError.message
    try {
      const body = await (mintError as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.()
      if (body?.error) message = body.error
    } catch {
      // ignore — fall back to mintError.message
    }
    throw new Error(message)
  }
  if (!mint) throw new Error('Could not authorize upload')

  const { data } = supabase.storage.from('game-assets').getPublicUrl(objectPath)
  return {
    token: mint.token,
    path: mint.path,
    publicUrl: data.publicUrl,
    signedUrl: mint.signedUrl,
  }
}

/**
 * PUT the file to the signed URL through XHR purely so upload progress exists;
 * fetch (and supabase-js on top of it) still has no request-progress events.
 * Any failure falls back to the library path in the caller.
 */
function putWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    if (file.type) xhr.setRequestHeader('content-type', file.type)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total)
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`))
    xhr.onerror = () => reject(new Error('Upload failed (network)'))
    xhr.send(file)
  })
}

/** Upload a file to a previously-minted signed URL. Fast: no edge function call. */
export async function uploadToMintedParticipantUrl(
  minted: MintedParticipantUpload,
  file: File,
  options?: { mediaKind?: UploadMediaKind; onProgress?: (fraction: number) => void },
): Promise<string> {
  const kind = options?.mediaKind ?? inferUploadMediaKind(file)
  const sizeError = validateUploadFileSize(file, kind)
  if (sizeError) throw new Error(sizeError)

  // Progress wanted and a signed URL available: XHR first, so 30-260s video
  // uploads (7 Aug event) show a moving percentage instead of a bare spinner.
  if (options?.onProgress && minted.signedUrl) {
    try {
      await putWithProgress(minted.signedUrl, file, options.onProgress)
      return minted.publicUrl
    } catch {
      // Fall through to the library path; progress just will not tick.
    }
  }

  const { error } = await supabase.storage
    .from('game-assets')
    .uploadToSignedUrl(minted.path, minted.token, file, {
      contentType: file.type || undefined,
    })
  if (error) throw error
  return minted.publicUrl
}

/**
 * Mint + upload in one call. Used where there is nothing to prefetch against (the
 * team claim photo, which is captured and submitted in a single step).
 */
export async function uploadParticipantAsset(
  eventId: string,
  path: string,
  file: File,
  options?: { mediaKind?: UploadMediaKind; onProgress?: (fraction: number) => void },
): Promise<string> {
  const kind = options?.mediaKind ?? inferUploadMediaKind(file)
  const sizeError = validateUploadFileSize(file, kind)
  if (sizeError) throw new Error(sizeError)

  const minted = await mintParticipantUpload(eventId, path)
  return uploadToMintedParticipantUrl(minted, file, {
    mediaKind: kind,
    onProgress: options?.onProgress,
  })
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

/**
 * Uploads a support ticket attachment and returns its metadata.
 *
 * Returns the object path rather than a URL, because the bucket is private:
 * there is no public URL, and a signed one would be stale by the time anyone
 * opened the ticket. Call `signedAttachmentUrl` at read time instead.
 */
export async function uploadSupportAttachment(
  organizationId: string,
  file: File,
): Promise<SupportTicketAttachment> {
  const sizeError = validateAttachmentUpload(file)
  if (sizeError) throw new Error(sizeError)

  const path = sanitizeStoragePath(`${organizationId}/${crypto.randomUUID()}-${file.name}`)
  const { error } = await supabase.storage
    .from('support-attachments')
    .upload(path, file, { upsert: false, contentType: file.type || undefined })
  if (error) throw error

  return { path, name: file.name, size: file.size, type: file.type }
}

/** Short-lived read URL for a private attachment. */
export async function signedAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('support-attachments')
    .createSignedUrl(path, 60 * 5)
  if (error) throw error
  return data.signedUrl
}
