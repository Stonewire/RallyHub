export const UPLOAD_MAX_PHOTO_BYTES = 15 * 1024 * 1024
export const UPLOAD_MAX_VIDEO_BYTES = 250 * 1024 * 1024
export const UPLOAD_MAX_AUDIO_BYTES = 50 * 1024 * 1024
/** Matches the file_size_limit on the user-avatars bucket. */
export const UPLOAD_MAX_AVATAR_BYTES = 2 * 1024 * 1024

export type UploadMediaKind = 'photo' | 'video' | 'audio' | 'logo' | 'avatar'

/**
 * Image types accepted for logos and avatars.
 *
 * image/svg+xml is deliberately absent. Both buckets are public, and an SVG is
 * a script-bearing document, so serving one from the project's own origin is a
 * stored-XSS vector. The storage buckets enforce the same allowlist server
 * side (see migration 20260715090000); this is the matching client-side check
 * so the user gets a clear message instead of an opaque storage rejection.
 */
export const ALLOWED_IMAGE_UPLOAD_TYPES = [
  'image/jpeg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const

/** Human-readable list for UI copy, e.g. "PNG, JPG or WEBP". */
export const ALLOWED_IMAGE_UPLOAD_LABEL = 'PNG, JPG, WEBP or AVIF'

export function isAllowedImageUploadType(file: File): boolean {
  return (ALLOWED_IMAGE_UPLOAD_TYPES as readonly string[]).includes(file.type)
}

/** Null when acceptable, otherwise the reason to show the user. */
export function validateImageUpload(
  file: File,
  kind: 'logo' | 'avatar',
): string | null {
  if (!isAllowedImageUploadType(file)) {
    return `Use ${ALLOWED_IMAGE_UPLOAD_LABEL}. SVG is not supported for security reasons.`
  }
  return validateUploadFileSize(file, kind)
}

export function maxBytesForUploadKind(kind: UploadMediaKind): number {
  switch (kind) {
    case 'photo':
    case 'logo':
      return UPLOAD_MAX_PHOTO_BYTES
    case 'avatar':
      return UPLOAD_MAX_AVATAR_BYTES
    case 'video':
      return UPLOAD_MAX_VIDEO_BYTES
    case 'audio':
      return UPLOAD_MAX_AUDIO_BYTES
  }
}

export function formatUploadMaxLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))}MB`
  }
  return `${Math.round(bytes / 1024)}KB`
}

export function inferUploadMediaKind(file: File): UploadMediaKind {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return 'photo'
}

export function uploadSizeErrorMessage(kind: UploadMediaKind): string {
  const label =
    kind === 'video'
      ? 'Video'
      : kind === 'audio'
        ? 'Audio file'
        : kind === 'avatar'
          ? 'Profile photo'
          : 'Image'
  return `${label} must be ${formatUploadMaxLabel(maxBytesForUploadKind(kind))} or smaller`
}

export function isUploadWithinSizeLimit(file: File, kind: UploadMediaKind): boolean {
  return file.size <= maxBytesForUploadKind(kind)
}

export function validateUploadFileSize(file: File, kind: UploadMediaKind): string | null {
  if (isUploadWithinSizeLimit(file, kind)) return null
  return uploadSizeErrorMessage(kind)
}
