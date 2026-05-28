/** Web Audio WAV fallback when ffmpeg.wasm is unavailable. */
export async function encodeWav(
  file: File,
  startSeconds: number,
  durationSeconds: number,
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer()
  const ctx = new AudioContext()
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
    const sampleRate = audioBuffer.sampleRate
    const startSample = Math.min(
      Math.floor(startSeconds * sampleRate),
      Math.max(0, audioBuffer.length - 1),
    )
    const clipSamples = Math.min(
      Math.floor(durationSeconds * sampleRate),
      audioBuffer.length - startSample,
    )
    const channels = audioBuffer.numberOfChannels
    const clipBuffer = ctx.createBuffer(channels, clipSamples, sampleRate)
    for (let ch = 0; ch < channels; ch++) {
      const src = audioBuffer.getChannelData(ch)
      const dest = clipBuffer.getChannelData(ch)
      dest.set(src.subarray(startSample, startSample + clipSamples))
    }
    return encodeWavFromBuffer(clipBuffer)
  } finally {
    void ctx.close()
  }
}

function encodeWavFromBuffer(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bitDepth = 16
  const samples = buffer.length
  const blockAlign = (numChannels * bitDepth) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = samples * blockAlign
  const header = new ArrayBuffer(44 + dataSize)
  const view = new DataView(header)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  const channelData: Float32Array[] = []
  for (let ch = 0; ch < numChannels; ch++) channelData.push(buffer.getChannelData(ch))

  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([header], { type: 'audio/wav' })
}
