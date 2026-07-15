import type { EventStatus } from '@/types/database'
import type { EventRow } from '@/hooks/use-events'

const ALL_STATUSES: EventStatus[] = ['active', 'demo', 'ready', 'draft', 'archived']

/** Reset gameplay data is only allowed before activation (draft, ready, demo). */
export function canResetEventData(status: string | null | undefined): boolean {
  return status === 'draft' || status === 'ready' || status === 'demo'
}

/**
 * True once the event has actually gone live.
 *
 * This keys off activated_at, not invoice creation or payment state. Billing may
 * be retried independently; only an actual activation locks the event lifecycle.
 */
export function isEventActivated(
  event: Pick<EventRow, 'activated_at'>,
): boolean {
  return event.activated_at != null
}

/** Status options allowed for this event given one-way activation rules. */
export function getAllowedEventStatuses(
  event: Pick<EventRow, 'status' | 'activated_at'>,
): EventStatus[] {
  const current = event.status as EventStatus

  if (!isEventActivated(event)) {
    return ALL_STATUSES
  }

  if (current === 'archived') {
    return ['archived']
  }

  return [current, 'archived']
}

export function canTransitionEventStatus(
  event: Pick<EventRow, 'status' | 'activated_at'>,
  nextStatus: EventStatus,
): boolean {
  return getAllowedEventStatuses(event).includes(nextStatus)
}

export function eventStatusTransitionError(
  event: Pick<EventRow, 'status' | 'activated_at'>,
  nextStatus: EventStatus,
): string | null {
  if (canTransitionEventStatus(event, nextStatus)) return null
  if (isEventActivated(event)) {
    return 'This event has already been activated and billed. It can only be archived. Duplicate the event to run it again.'
  }
  return `Cannot change status to ${nextStatus}.`
}
