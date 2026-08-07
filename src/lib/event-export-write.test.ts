import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import { writeZipToDisk } from '@/lib/event-export'

/**
 * The 7 Aug 2026 export shipped photos that listed in the archive but would
 * not open. Cause: the stream's 'end' resolved while the final disk write was
 * still in flight, so close() truncated the archive's tail. A writer that
 * settles slowly makes that race deterministic.
 */
function slowWritable() {
  const events: string[] = []
  let pending = 0
  const handle = {
    createWritable: async () => ({
      write: async (chunk: Uint8Array) => {
        pending += 1
        events.push(`write:start:${chunk.byteLength}`)
        // Settle on a later macrotask so a close() that does not wait wins.
        await new Promise((r) => setTimeout(r, 5))
        pending -= 1
        events.push('write:done')
      },
      close: async () => {
        events.push(pending > 0 ? 'close:WHILE_WRITES_PENDING' : 'close:clean')
      },
      abort: async () => {
        events.push('abort')
      },
    }),
  }
  return { handle, events }
}

describe('writeZipToDisk', () => {
  it('closes the file only after every chunk has been written', async () => {
    const zip = new JSZip()
    // Enough content to emit several chunks.
    for (let i = 0; i < 12; i++) {
      zip.file(`photo-${i}.jpg`, new Uint8Array(40_000).fill(i))
    }
    const { handle, events } = slowWritable()

    await writeZipToDisk(zip, handle as unknown as FileSystemFileHandle)

    expect(events).toContain('close:clean')
    expect(events).not.toContain('close:WHILE_WRITES_PENDING')
    // Close is the final act, after the last write settled.
    expect(events[events.length - 1]).toBe('close:clean')
    expect(events[events.length - 2]).toBe('write:done')
  })
})
