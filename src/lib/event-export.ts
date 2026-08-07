import JSZip from 'jszip'

import { toCsv } from '@/lib/csv'
import { supabase } from '@/lib/supabase'
import { puzzleSubmissionStatLabel } from '@/lib/text-game'
import type { Tables } from '@/types/helpers'

/**
 * Real events are large: the 30 Jul 2026 client event was 134 files / 562 MB.
 * The original export downloaded them one at a time with no timeout, held
 * every blob, then asked JSZip to accumulate the whole archive in the JS heap
 * before emitting a single Blob. That reads as a permanently "Preparing…"
 * button. Downloads now run in parallel with timeouts and retries, and the
 * archive is streamed to disk where the browser allows it, so peak memory is
 * roughly one file rather than the whole event.
 */
const DOWNLOAD_CONCURRENCY = 6
const FETCH_TIMEOUT_MS = 120_000

export type ExportProgress = {
  phase: 'downloading' | 'packaging'
  done: number
  total: number
  /** Bytes fetched so far; the packaging phase leaves this at its final value. */
  bytes: number
}

type MediaTask = {
  url: string
  folder: 'media' | 'teams'
  /** File name inside the archive. */
  name: string
  /** Human label used in the missing-files report. */
  label: string
}

/** Windows-safe archive entry name. */
export function safeFileName(input: string): string {
  return input.replace(/[^\w.-]+/g, '_').slice(0, 120)
}

/** Human byte size for export progress ("41 MB"). */
export function formatMb(bytes: number): string {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function extFromUrl(url: string, fallback: string) {
  const path = url.split('?')[0] ?? ''
  const m = path.match(/\.([a-z0-9]+)$/i)
  return m?.[1] ?? fallback
}

/**
 * Run `fn` over `items` with at most `limit` in flight. Results keep input
 * order. Used so 134 files are not fetched one at a time.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (;;) {
        const index = next++
        if (index >= items.length) return
        results[index] = await fn(items[index]!, index)
      }
    }),
  )
  return results
}

/** Fetch with a timeout and one retry. Returns null when the file is lost. */
async function fetchBlobWithRetry(url: string): Promise<Blob | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(url, { signal: controller.signal })
      // A 4xx is a real answer (deleted or forbidden); retrying cannot help.
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500) return null
        throw new Error(`HTTP ${res.status}`)
      }
      return await res.blob()
    } catch {
      // Network error or timeout: fall through to the retry.
    } finally {
      window.clearTimeout(timer)
    }
  }
  return null
}

type SaveTarget = { kind: 'stream'; handle: FileSystemFileHandle } | { kind: 'blob' }

type WritableFile = {
  write: (data: ArrayBufferView) => Promise<void>
  close: () => Promise<void>
  abort?: () => Promise<void>
}

/**
 * Ask where to save BEFORE any await: the File System Access picker requires
 * transient user activation, which is lost across network round trips. That is
 * also why the caller passes the event name in rather than us querying it.
 * Resolves null when the organiser cancels the picker.
 */
function pickSaveTarget(suggestedName: string): Promise<SaveTarget | null> {
  const picker = (
    window as Window & {
      showSaveFilePicker?: (options: unknown) => Promise<FileSystemFileHandle>
    }
  ).showSaveFilePicker

  if (typeof picker !== 'function') return Promise.resolve({ kind: 'blob' })

  return picker
    .call(window, {
      suggestedName,
      types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
    })
    .then((handle: FileSystemFileHandle) => ({ kind: 'stream' as const, handle }))
    .catch((err: unknown) => {
      // A cancelled picker is a deliberate no-op; anything else falls back.
      if (err instanceof DOMException && err.name === 'AbortError') return null
      return { kind: 'blob' as const }
    })
}

/** Stream the archive to disk, so the JS heap never holds the whole ZIP. */
/** Exported for the ordering test: close must never outrun the writes. */
export async function writeZipToDisk(
  zip: JSZip,
  handle: FileSystemFileHandle,
): Promise<void> {
  // Cast through unknown: intersecting with FileSystemFileHandle keeps the DOM
  // lib's stricter chunk type and rejects the Uint8Array JSZip emits.
  const writable = await (
    handle as unknown as { createWritable: () => Promise<WritableFile> }
  ).createWritable()

  try {
    await new Promise<void>((resolve, reject) => {
      const stream = zip.generateInternalStream({
        type: 'uint8array',
        // STORE: photos and videos are already compressed, so DEFLATE would
        // burn minutes of main-thread CPU for no size win.
        compression: 'STORE',
      })
      // Every write is chained, and 'end' waits for the chain to drain before
      // resolving. JSZip's 'end' only means it has finished PRODUCING bytes:
      // resolving there left the final write in flight while writable.close()
      // ran, truncating the archive's tail. The entries still listed, so the
      // damage showed up as photos that would not open (7 Aug 2026 export).
      let queue: Promise<void> = Promise.resolve()
      stream
        .on('data', (chunk: Uint8Array) => {
          // Pause while the disk write settles, or JSZip outruns the writer and
          // the chunks pile up in memory: exactly what this path avoids.
          stream.pause()
          queue = queue.then(() => writable.write(chunk))
          queue.then(() => stream.resume(), reject)
        })
        .on('error', reject)
        .on('end', () => {
          queue.then(() => resolve(), reject)
        })
      stream.resume()
    })
    await writable.close()
  } catch (err) {
    await writable.abort?.()
    throw err
  }
}

/** Fallback for browsers without the File System Access API. */
async function downloadZipAsBlob(
  zip: JSZip,
  fileName: string,
  onProgress?: (p: ExportProgress) => void,
  bytes = 0,
): Promise<void> {
  const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, (meta) =>
    onProgress?.({
      phase: 'packaging',
      done: Math.round(meta.percent),
      total: 100,
      bytes,
    }),
  )
  const url = URL.createObjectURL(out)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking immediately can cancel an in-flight download of a large archive.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export type ExportResult = {
  /** Files that could not be downloaded, after one retry each. */
  missing: string[]
  /** False when the organiser cancelled the save dialog. */
  saved: boolean
}

export async function downloadEventPackage(
  eventId: string,
  eventName: string,
  onProgress?: (p: ExportProgress) => void,
): Promise<ExportResult> {
  const archiveName = `${safeFileName(eventName || 'event')}-export.zip`
  // Must run before the first await to keep the user activation.
  const target = await pickSaveTarget(archiveName)
  if (!target) return { missing: [], saved: false }

  const { data: event, error: eErr } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .single()
  if (eErr || !event) throw new Error('Event not found')

  const [teamsRes, subsRes, egRes] = await Promise.all([
    supabase.from('teams').select('*').eq('event_id', eventId).order('slot_number'),
    supabase.from('submissions').select('*').eq('event_id', eventId),
    supabase.from('event_games').select('game_id').eq('event_id', eventId),
  ])

  if (teamsRes.error) throw teamsRes.error
  if (subsRes.error) throw subsRes.error
  if (egRes.error) throw egRes.error

  const teams = teamsRes.data ?? []
  const submissions = subsRes.data ?? []
  const gameIds = (egRes.data ?? []).map((r) => r.game_id)

  let games: Tables<'games'>[] = []
  if (gameIds.length > 0) {
    const { data, error } = await supabase.from('games').select('*').in('id', gameIds)
    if (error) throw error
    games = data ?? []
  }

  const tasks: MediaTask[] = []

  for (const team of teams) {
    if (!team.photo_url) continue
    tasks.push({
      url: team.photo_url,
      folder: 'teams',
      name: `${team.slot_number}-${safeFileName(team.name ?? 'team')}.${extFromUrl(team.photo_url, 'jpg')}`,
      label: `Team ${team.slot_number} (${team.name ?? 'unnamed'}) photo`,
    })
  }

  for (const sub of submissions) {
    if (!sub.media_url || sub.media_type?.startsWith('quiz') || sub.media_type === 'puzzle')
      continue
    const team = teams.find((t) => t.id === sub.team_id)
    const game = games.find((g) => g.id === sub.game_id)
    const base = `${team?.name ?? sub.team_id}-${game?.name ?? sub.game_id}-${sub.status}`
    const ext =
      sub.media_type === 'video'
        ? extFromUrl(sub.media_url, 'webm')
        : extFromUrl(sub.media_url, 'jpg')
    tasks.push({
      url: sub.media_url,
      folder: 'media',
      name: `${safeFileName(base)}.${ext}`,
      label: `${team?.name ?? 'Unknown team'} - ${game?.name ?? 'Unknown game'} (${sub.media_type})`,
    })
  }

  const zip = new JSZip()
  const mediaFolder = zip.folder('media')!
  const teamsFolder = zip.folder('teams')!

  let done = 0
  let bytes = 0
  const missing: string[] = []
  onProgress?.({ phase: 'downloading', done: 0, total: tasks.length, bytes: 0 })

  const blobs = await mapWithConcurrency(tasks, DOWNLOAD_CONCURRENCY, async (task) => {
    const blob = await fetchBlobWithRetry(task.url)
    done += 1
    if (blob) bytes += blob.size
    else missing.push(task.label)
    onProgress?.({ phase: 'downloading', done, total: tasks.length, bytes })
    return blob
  })

  // Added after the downloads settle so archive order stays deterministic.
  blobs.forEach((blob, i) => {
    if (!blob) return
    const task = tasks[i]!
    const folder = task.folder === 'teams' ? teamsFolder : mediaFolder
    folder.file(task.name, blob)
  })

  // The branded PDF report is deferred until we build the real one. For now the
  // package is photos + videos, plus quiz/bingo log data (which has no
  // downloadable media) so those results aren't lost.
  const hasQuizOrBingo = games.some(
    (g) => g.type === 'quiz' || g.type === 'music_bingo' || g.type === 'puzzle',
  )
  if (hasQuizOrBingo) {
    const rows = submissions
      .filter((s) => {
        const g = games.find((gg) => gg.id === s.game_id)
        return g?.type === 'quiz' || g?.type === 'music_bingo' || g?.type === 'puzzle'
      })
      .map((s) => {
        const g = games.find((gg) => gg.id === s.game_id)
        return [
          teams.find((t) => t.id === s.team_id)?.name ?? s.team_id,
          g?.name ?? s.game_id,
          g?.type ?? '',
          s.status ?? '',
          s.points_awarded ?? 0,
          s.media_type === 'puzzle' ? puzzleSubmissionStatLabel(s.media_url) : '',
        ]
      })

    const csv = toCsv(['Team', 'Game', 'Type', 'Status', 'Points', 'Result'], rows)
    zip.file('quiz-bingo-results.csv', csv)
  }

  // An incomplete archive must say so rather than quietly look complete.
  if (missing.length > 0) {
    zip.file(
      'MISSING-FILES.txt',
      [
        `${missing.length} of ${tasks.length} files could not be downloaded.`,
        'They may have been deleted from storage, or the connection dropped.',
        '',
        ...missing.map((m) => `- ${m}`),
      ].join('\n'),
    )
  }

  onProgress?.({ phase: 'packaging', done: 0, total: 100, bytes })
  if (target.kind === 'stream') {
    await writeZipToDisk(zip, target.handle)
    onProgress?.({ phase: 'packaging', done: 100, total: 100, bytes })
  } else {
    await downloadZipAsBlob(zip, archiveName, onProgress, bytes)
  }

  return { missing, saved: true }
}
