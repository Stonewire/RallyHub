/** Prefer formats that play back in Safari/iOS review UI. */
export function pickVideoRecorderMime(): string {
  const candidates = [
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime
    }
  }
  return 'video/webm'
}

export function videoFileExtension(mime: string): string {
  if (mime.includes('mp4')) return 'mp4'
  return 'webm'
}
