/**
 * Cover framing shared between the crop modal and the fields that open it.
 *
 * Cover images are often part of the clue, so nothing is cropped behind the
 * organiser's back — they frame it themselves, and the player then shows the
 * result at its own height.
 */
export const COVER_ASPECT = 2
export const COVER_EXPORT_WIDTH = 1600
export const COVER_SIZE_HINT = `Ideal size ${COVER_EXPORT_WIDTH} × ${COVER_EXPORT_WIDTH / COVER_ASPECT}px`

export type PendingCover = { name: string; src: string }

/**
 * Reads a picked file into a data URL. Deliberately not an object URL: those
 * are revoked on unmount, and StrictMode's remount left the modal showing a
 * dead src.
 */
export function readCoverFile(file: File): Promise<PendingCover> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ name: file.name, src: String(reader.result) })
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
