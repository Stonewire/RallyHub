import { UPLOAD_MAX_VIDEO_BYTES } from '@/lib/upload-limits'

/** High-quality AAC — transparent at typical phone mic distances. */
export const VIDEO_RECORD_AUDIO_BITS_PER_SECOND = 192_000

/** Floor so short clips are not starved; still efficient on mobile. */
export const VIDEO_RECORD_MIN_BITS_PER_SECOND = 4_000_000

/** Cap for 4K-class sensors; avoids runaway file sizes on long clips. */
export const VIDEO_RECORD_MAX_BITS_PER_SECOND = 20_000_000

const BITS_PER_PIXEL_PER_FRAME = 0.08
const TARGET_FPS = 30

function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

/**
 * Prefer formats that play back in Safari/iOS review UI — EXCEPT on Android.
 * `video/mp4` there hands the recording to a hardware H.264 encoder that shares
 * the camera pipeline with the live preview. Attaching it while the preview is
 * already running is a known source of a black/flickering preview and no
 * output the moment recording starts, on tablets in particular. `vp8`/`vp9` use
 * a software encoder that doesn't touch the camera hardware. Desktop/iOS Safari
 * still need `mp4` first: they support no vp8/vp9 MediaRecorder output at all.
 */
export function pickVideoRecorderMime(): string {
  const candidates = isAndroid()
    ? ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
    : ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
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

export function canRecordVideoInBrowser(): boolean {
  if (typeof MediaRecorder === 'undefined') return false
  const mime = pickVideoRecorderMime()
  return MediaRecorder.isTypeSupported(mime)
}

/**
 * Target visually lossless bitrate for the stream resolution.
 * When maxDurationSec is set, caps bitrate so typical clips stay under upload limits
 * while still using as much budget as possible.
 */
export function computeVideoBitsPerSecond(
  width: number,
  height: number,
  maxDurationSec?: number,
): number {
  const pixels = Math.max(1, width * height)
  let bits = Math.round(pixels * BITS_PER_PIXEL_PER_FRAME * TARGET_FPS)
  bits = Math.min(VIDEO_RECORD_MAX_BITS_PER_SECOND, Math.max(VIDEO_RECORD_MIN_BITS_PER_SECOND, bits))

  if (maxDurationSec != null && maxDurationSec > 0) {
    const uploadBudgetBits =
      (UPLOAD_MAX_VIDEO_BYTES * 0.92 * 8) / maxDurationSec - VIDEO_RECORD_AUDIO_BITS_PER_SECOND
    if (uploadBudgetBits > VIDEO_RECORD_MIN_BITS_PER_SECOND) {
      bits = Math.min(bits, Math.floor(uploadBudgetBits))
    }
  }

  return bits
}

export function buildVideoRecorderOptions(
  stream: MediaStream,
  mimeType: string,
  maxDurationSec?: number,
): MediaRecorderOptions {
  const track = stream.getVideoTracks()[0]
  const { width = 1920, height = 1080 } = track?.getSettings() ?? {}
  return {
    mimeType,
    videoBitsPerSecond: computeVideoBitsPerSecond(width, height, maxDurationSec),
    audioBitsPerSecond: VIDEO_RECORD_AUDIO_BITS_PER_SECOND,
  }
}

/** Create MediaRecorder with high bitrate; fall back if the browser rejects options. */
export function createVideoRecorder(
  stream: MediaStream,
  maxDurationSec?: number,
): MediaRecorder {
  const mime = pickVideoRecorderMime()
  const options = buildVideoRecorderOptions(stream, mime, maxDurationSec)
  try {
    return new MediaRecorder(stream, options)
  } catch {
    try {
      return new MediaRecorder(stream, { mimeType: mime })
    } catch {
      return new MediaRecorder(stream)
    }
  }
}

export function videoMimeForRecorder(recorder: MediaRecorder): string {
  return recorder.mimeType || pickVideoRecorderMime()
}
