import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

import { readAudioDuration, suggestClipStart } from '@/lib/audio-metadata'
import { encodeWav } from '@/lib/extract-audio-wav-fallback'

let ffmpeg: FFmpeg | null = null
let loadPromise: Promise<FFmpeg> | null = null

async function getFfmpeg(): Promise<FFmpeg> {
  if (ffmpeg?.loaded) return ffmpeg
  if (!loadPromise) {
    loadPromise = (async () => {
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
    const inputName = `in-${crypto.randomUUID()}.${file.name.split('.').pop() ?? 'mp3'}`
    const outputName = 'out.mp3'
    await ff.writeFile(inputName, await fetchFile(file))
    await ff.exec([
      '-ss',
      String(startSeconds),
      '-i',
      inputName,
      '-t',
      String(durationSeconds),
      '-acodec',
      'libmp3lame',
      '-b:a',
      '128k',
      '-ar',
      '44100',
      '-ac',
      '2',
      outputName,
    ])
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
