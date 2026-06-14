export const UPLOAD_MAX_PHOTO_BYTES = 15 * 1024 * 1024
export const UPLOAD_MAX_VIDEO_BYTES = 250 * 1024 * 1024
export const UPLOAD_MAX_AUDIO_BYTES = 50 * 1024 * 1024

export type UploadMediaKind = 'photo' | 'video' | 'audio' | 'logo'

export function maxBytesForUploadKind(kind: UploadMediaKind): number {
  switch (kind) {
    case 'photo':
    case 'logo':
      return UPLOAD_MAX_PHOTO_BYTES
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
    kind === 'video' ? 'Video' : kind === 'audio' ? 'Audio file' : 'Image'
  return `${label} must be ${formatUploadMaxLabel(maxBytesForUploadKind(kind))} or smaller`
}

export function isUploadWithinSizeLimit(file: File, kind: UploadMediaKind): boolean {
  return file.size <= maxBytesForUploadKind(kind)
}

export function validateUploadFileSize(file: File, kind: UploadMediaKind): string | null {
  if (isUploadWithinSizeLimit(file, kind)) return null
  return uploadSizeErrorMessage(kind)
}
