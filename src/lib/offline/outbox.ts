// The submission outbox: a durable FIFO queue that makes every submission feel
// instant and, once Stage 3 plugs in persistence, survive going offline.
//
// The player's submit returns to the challenge list the moment an item is
// enqueued; the actual work (upload media, insert the row, reconcile the score)
// runs in the background as the queue drains. Online this just feels instant
// (no more waiting on a video upload — CF4-4). Offline the item waits in the
// queue and drains when the connection returns.
//
// Transport-agnostic by design: this module owns ordering, retries, backoff,
// drain triggers and (Stage 3) persistence. The caller supplies process(item),
// which knows how to actually send one item (upload + Supabase insert +
// reconcile). Supabase never appears in here.

export type OutboxKind = 'open-submission' | 'puzzle-result' | 'store-order'

export type OutboxItem = {
  /** Also the submissions row primary key, so a retried insert is a safe
   *  duplicate-key no-op. The queue's only dedup mechanism. */
  clientId: string
  eventId: string
  teamId: string
  kind: OutboxKind
  gameId: string
  /** Original moment the player pressed submit, preserved through the queue so
   *  the activity log and time-decay scoring stay honest even on a late drain. */
  createdAt: string
  /** Free-form payload the caller's process() understands (e.g. for an open
   *  submission { mediaType, textValue? }). */
  payload: Record<string, unknown>
  /** Set when a media blob for this item lives in the blob cache (Stage 3). */
  blobKey?: string
}

export type OutboxItemState = 'queued' | 'sending' | 'failed'

/** Thrown by process() for errors that must NOT be retried (validation, a file
 *  too large, a closed event). The item is dropped and the caller notified,
 *  rather than retried forever. Anything else thrown is treated as transient. */
export class PermanentSubmitError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'PermanentSubmitError'
  }
}

/** Thrown by process() for a genuine connectivity failure (offline, captive
 *  portal, dead AP). Retried indefinitely with backoff and NEVER counted toward
 *  the give-up cap — the whole point of the durable queue is to survive an
 *  outage that outlasts a few retries. A plain Error means a server-side
 *  transient, which DOES count toward the cap. */
export class NetworkSubmitError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'NetworkSubmitError'
  }
}

export type OutboxPersistence = {
  load: () => Promise<OutboxItem[]>
  add: (item: OutboxItem) => Promise<void>
  remove: (clientId: string) => Promise<void>
}

export type OutboxHooks = {
  /** Send one item. Resolve on success; throw PermanentSubmitError to drop it,
   *  throw anything else to keep it queued and retry the whole queue later. */
  process: (item: OutboxItem) => Promise<void>
  /** Reachability, not just navigator.onLine (which lies). Default: always on. */
  isOnline?: () => boolean
  /** Per-item state changes, for the "waiting to send" UI. */
  onState?: (clientId: string, state: OutboxItemState, error?: unknown) => void
  /** An item was dropped for good (permanent error). */
  onDropped?: (item: OutboxItem, error: unknown) => void
  /** An item left the queue for good — sent successfully or permanently
   *  dropped. Fires exactly once per item; use it to clear per-item UI. */
  onSettled?: (clientId: string) => void
  /** In-memory only when omitted (Stage 1). Stage 3 supplies IndexedDB. */
  persistence?: OutboxPersistence
  /** Backoff schedule in ms per consecutive failed round; last value repeats. */
  backoffMs?: number[]
  /** Give up on an item after this many transient failures and drop it (so the
   *  player is told and the queue frees) instead of retrying forever. */
  maxAttempts?: number
  /** Injectable for tests; defaults to setTimeout. */
  schedule?: (fn: () => void, ms: number) => void
}

const DEFAULT_BACKOFF = [1_000, 4_000, 15_000, 30_000]
const DEFAULT_MAX_ATTEMPTS = 8

export class Outbox {
  private queue: OutboxItem[] = []
  private draining = false
  private failedRounds = 0
  private retryArmed = false
  /** Bumped whenever the backoff is reset (kick). A scheduled retry captures the
   *  generation it was armed under and no-ops if it has since been superseded,
   *  so a kick() can never leave a stale timer firing alongside a fresh one. */
  private retryGen = 0
  /** Set by stop(): this instance must never process another item. Guards the
   *  unmount case — an armed retry timer or in-flight drain would otherwise
   *  keep a zombie outbox alive after React tore the surface down, draining
   *  under a stale auth context or racing a newer mount for the same items. */
  private disposed = false
  /** Per-item transient-failure counter, so one stuck item cannot loop forever. */
  private attempts = new Map<string, number>()
  private readonly hooks: OutboxHooks
  private readonly backoff: number[]
  private readonly maxAttempts: number
  private readonly schedule: (fn: () => void, ms: number) => void

  constructor(hooks: OutboxHooks) {
    this.hooks = hooks
    this.backoff = hooks.backoffMs ?? DEFAULT_BACKOFF
    this.maxAttempts = hooks.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
    this.schedule = hooks.schedule ?? ((fn, ms) => void setTimeout(fn, ms))
  }

  /** Rehydrate from persistence (Stage 3) and start draining. Safe to call once
   *  at startup; a no-op queue when there is no persistence. */
  async start(): Promise<void> {
    if (this.hooks.persistence) {
      const items = await this.hooks.persistence.load()
      for (const item of items) {
        if (!this.queue.some((q) => q.clientId === item.clientId)) this.queue.push(item)
      }
    }
    void this.drain()
  }

  private isOnline(): boolean {
    return this.hooks.isOnline ? this.hooks.isOnline() : true
  }

  /** Add an item and kick the drain. Resolves once persisted, not once sent.
   *  Respects an armed backoff so a burst of submits cannot hammer a failing
   *  endpoint — the pending retry timer will pick the new items up. */
  async enqueue(item: OutboxItem): Promise<void> {
    if (this.disposed) return
    if (this.queue.some((q) => q.clientId === item.clientId)) return
    // In-memory FIRST so a persistence failure (quota, no Cache API) can never
    // lose the submission — it still drains this session. Persistence only adds
    // cross-reload durability, and its failure degrades to in-memory-only.
    this.queue.push(item)
    this.hooks.onState?.(item.clientId, 'queued')
    void this.drain()
    try {
      await this.hooks.persistence?.add(item)
      // A fast drain can deliver the item while its blob was still being
      // written; if the item already settled, undo the late write so the next
      // load cannot resurrect an already-delivered submission. (Not after
      // stop() — there the queue was cleared with items unsettled, and the
      // persisted copy is exactly what the next mount must rehydrate.)
      if (!this.disposed && !this.queue.some((q) => q.clientId === item.clientId)) {
        await this.hooks.persistence?.remove(item.clientId)
      }
    } catch {
      // Keep going; the item is queued in memory and will drain while the app
      // stays open. It just won't survive a reload.
    }
    void this.drain()
  }

  /** Permanently stop this instance: no further drains, retries, or enqueues.
   *  Queued items stay persisted for the next mount to rehydrate. Call from the
   *  owning component's unmount. */
  stop(): void {
    this.disposed = true
    this.retryGen += 1 // neutralize any armed retry timer
    this.queue = []
  }

  /** Force an immediate drain, ignoring any backoff — for when connectivity has
   *  likely returned (window 'online'/focus). Resets the backoff so a reconnect
   *  retries now rather than waiting out the last delay. */
  kick(): void {
    // Invalidate any pending retry timer so it cannot fire alongside the fresh
    // drain and collapse the backoff (which would burn the per-item cap and
    // drop a submission the reconnect was about to deliver).
    this.retryGen += 1
    this.retryArmed = false
    this.failedRounds = 0
    void this.drain()
  }

  pending(): OutboxItem[] {
    return [...this.queue]
  }

  hasPending(): boolean {
    return this.queue.length > 0
  }

  /** Drain FIFO, one item at a time. Re-entrant-safe. A transient failure means
   *  the connection is down (every item would fail the same way), so we stop and
   *  retry the whole queue after a backoff. A permanent failure drops just that
   *  item and moves on. */
  async drain(): Promise<void> {
    // Skip while a backoff retry is already armed (an enqueue during the window
    // must not bypass it) or while offline; kick() clears the arm on reconnect.
    if (this.disposed) return
    if (this.draining || this.retryArmed || !this.isOnline() || this.queue.length === 0) return
    this.draining = true
    try {
      while (this.queue.length > 0 && this.isOnline() && !this.disposed) {
        const item = this.queue[0]
        this.hooks.onState?.(item.clientId, 'sending')
        try {
          await this.hooks.process(item)
          this.attempts.delete(item.clientId)
          await this.removeItem(item.clientId)
          this.failedRounds = 0
        } catch (err) {
          if (err instanceof PermanentSubmitError) {
            this.dropHead(item, err)
            continue
          }
          // A genuine connectivity failure retries forever with backoff and is
          // NEVER counted toward the give-up cap — a venue outage that outlasts
          // a few retries must not discard the submission. Only a server-side
          // transient (a plain Error) counts toward maxAttempts.
          if (!(err instanceof NetworkSubmitError)) {
            const n = (this.attempts.get(item.clientId) ?? 0) + 1
            this.attempts.set(item.clientId, n)
            if (n >= this.maxAttempts) {
              this.dropHead(item, err)
              continue
            }
          }
          this.hooks.onState?.(item.clientId, 'failed', err)
          this.armRetry()
          break
        }
      }
    } finally {
      this.draining = false
    }
  }

  private dropHead(item: OutboxItem, err: unknown): void {
    this.attempts.delete(item.clientId)
    this.failedRounds = 0
    void this.removeItem(item.clientId)
    this.hooks.onDropped?.(item, err)
  }

  private armRetry(): void {
    if (this.retryArmed) return
    this.retryArmed = true
    const gen = this.retryGen
    const wait = this.backoff[Math.min(this.failedRounds, this.backoff.length - 1)]
    this.failedRounds += 1
    this.schedule(() => {
      // A kick() (reconnect) since this timer was armed supersedes it — do
      // nothing, the kick already restarted the drain on a fresh generation.
      if (gen !== this.retryGen) return
      this.retryArmed = false
      void this.drain()
    }, wait)
  }

  /** Never rejects: a failed durable delete only risks a benign resurrect on
   *  the next load, which the duplicate-key reconcile path already absorbs.
   *  Rejecting here would misfile a DELIVERED item as a transient failure in
   *  drain()'s catch and skip onSettled, wedging the caller's per-item UI. */
  private async removeItem(clientId: string): Promise<void> {
    this.queue = this.queue.filter((q) => q.clientId !== clientId)
    try {
      await this.hooks.persistence?.remove(clientId)
    } catch {
      // Ignore: record/blob may linger until the stale prune or next settle.
    }
    this.hooks.onSettled?.(clientId)
  }
}
