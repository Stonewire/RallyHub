import type { FFmpeg } from '@ffmpeg/ffmpeg'

import { readAudioDuration, suggestClipStart } from '@/lib/audio-metadata'
import { encodeWav } from '@/lib/extract-audio-wav-fallback'

let ffmpeg: FFmpeg | null = null
let loadPromise: Promise<FFmpeg> | null = null

async function getFfmpeg(): Promise<FFmpeg> {
  if (ffmpeg?.loaded) return ffmpeg
  if (!loadPromise) {
    loadPromise = (async () => {
      // ENG4: loaded on demand so ffmpeg stays out of the main bundle (it is
      // only used when an admin extracts music clips).
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import('@ffmpeg/ffmpeg'),
        import('@ffmpeg/util'),
      ])
      const instance = new FFmpeg()
      const base = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm'
      await instance.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      ffmpeg = instance
      return instance
    })()
  }
  return loadPromise
}

export type ExtractedClip = {
  blob: Blob
  mimeType: string
  extension: string
  startSeconds: number
  durationSeconds: number
}

/**
 * Single-pass loudnorm at the streaming standard (I=-14 LUFS, TP=-1.5 dBTP,
 * LRA=11) so a quiet upload and a loud upload cut to clips with the same
 * perceived loudness.
 */
export const LOUDNORM_FILTER = 'loudnorm=I=-14:TP=-1.5:LRA=11'

/**
 * ffmpeg argument list for cutting one normalised MP3 clip. Kept pure so the
 * command shape is testable without loading ffmpeg.wasm. loudnorm resamples
 * internally, so the explicit -ar 44100 must stay to pin the output rate.
 */
export function buildClipCommand(
  inputName: string,
  outputName: string,
  startSeconds: number,
  durationSeconds: number,
): string[] {
  return [
    '-ss',
    String(startSeconds),
    '-i',
    inputName,
    '-t',
    String(durationSeconds),
    '-af',
    LOUDNORM_FILTER,
    '-acodec',
    'libmp3lame',
    '-b:a',
    '128k',
    '-ar',
    '44100',
    '-ac',
    '2',
    outputName,
  ]
}

/** Extract MP3 clip (falls back to WAV if ffmpeg fails). */
export async function extractAudioClip(
  file: File,
  durationSeconds: number,
  startSecondsOverride?: number,
): Promise<ExtractedClip> {
  const duration = await readAudioDuration(file).catch(() => 0)
  const startSeconds = startSecondsOverride ?? suggestClipStart(duration)

  try {
    const ff = await getFfmpeg()
    const { fetchFile } = await import('@ffmpeg/util')
    const inputName = `in-${crypto.randomUUID()}.${file.name.split('.').pop() ?? 'mp3'}`
    const outputName = 'out.mp3'
    await ff.writeFile(inputName, await fetchFile(file))
    await ff.exec(buildClipCommand(inputName, outputName, startSeconds, durationSeconds))
    const data = await ff.readFile(outputName)
    await ff.deleteFile(inputName)
    await ff.deleteFile(outputName)
    const bytes =
      data instanceof Uint8Array
        ? data
        : new TextEncoder().encode(String(data))
    return {
      blob: new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' }),
      mimeType: 'audio/mpeg',
      extension: 'mp3',
      startSeconds,
      durationSeconds,
    }
  } catch {
    const wav = await extractAudioClipWavFallback(file, startSeconds, durationSeconds)
    return {
      blob: wav,
      mimeType: 'audio/wav',
      extension: 'wav',
      startSeconds,
      durationSeconds,
    }
  }
}

/**
 * Web Audio fallback when ffmpeg.wasm cannot load. It has no loudnorm, so
 * clips cut this way keep the source loudness.
 */
async function extractAudioClipWavFallback(
  file: File,
  startSeconds: number,
  durationSeconds: number,
): Promise<Blob> {
  return encodeWav(file, startSeconds, durationSeconds)
}

/** @deprecated use extractAudioClip */
export async function extractAudioClipWav(
  file: File,
  startSeconds: number,
  durationSeconds: number,
): Promise<Blob> {
  const result = await extractAudioClip(file, durationSeconds, startSeconds)
  return result.blob
}
