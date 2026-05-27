/** Read MP3 duration in the browser; suggest clip start for ~30s bingo clips. */
export function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(audio.duration) ? audio.duration : 0)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read audio metadata'))
    }
    audio.src = url
  })
}

export function suggestClipStart(durationSeconds: number): number {
  if (durationSeconds <= 35) return 0
  const quarter = Math.floor(durationSeconds * 0.25)
  return Math.min(90, Math.max(15, quarter))
}
