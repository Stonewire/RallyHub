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
  /** Injectable for tests; defaults to setTimeout. */
  schedule?: (fn: () => void, ms: number) => void
}

const DEFAULT_BACKOFF = [1_000, 4_000, 15_000, 30_000]

export class Outbox {
  private queue: OutboxItem[] = []
  private draining = false
  private failedRounds = 0
  private retryArmed = false
  private readonly hooks: OutboxHooks
  private readonly backoff: number[]
  private readonly schedule: (fn: () => void, ms: number) => void

  constructor(hooks: OutboxHooks) {
    this.hooks = hooks
    this.backoff = hooks.backoffMs ?? DEFAULT_BACKOFF
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

  /** Add an item and kick the drain. Resolves once persisted, not once sent. */
  async enqueue(item: OutboxItem): Promise<void> {
    if (this.queue.some((q) => q.clientId === item.clientId)) return
    await this.hooks.persistence?.add(item)
    this.queue.push(item)
    this.hooks.onState?.(item.clientId, 'queued')
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
    if (this.draining || !this.isOnline() || this.queue.length === 0) return
    this.draining = true
    try {
      while (this.queue.length > 0 && this.isOnline()) {
        const item = this.queue[0]
        this.hooks.onState?.(item.clientId, 'sending')
        try {
          await this.hooks.process(item)
          await this.removeItem(item.clientId)
          this.failedRounds = 0
        } catch (err) {
          if (err instanceof PermanentSubmitError) {
            await this.removeItem(item.clientId)
            this.hooks.onDropped?.(item, err)
            continue
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

  private armRetry(): void {
    if (this.retryArmed) return
    this.retryArmed = true
    const wait = this.backoff[Math.min(this.failedRounds, this.backoff.length - 1)]
    this.failedRounds += 1
    this.schedule(() => {
      this.retryArmed = false
      void this.drain()
    }, wait)
  }

  private async removeItem(clientId: string): Promise<void> {
    this.queue = this.queue.filter((q) => q.clientId !== clientId)
    await this.hooks.persistence?.remove(clientId)
    this.hooks.onSettled?.(clientId)
  }
}
