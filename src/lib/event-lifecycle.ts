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
 * This keys off activated_at, NOT invoiced_at. They used to mean the same thing
 * (an invoice was only ever created at activation), but Free-plan prepay now
 * creates the invoice BEFORE the event goes live, so it can be paid for first.
 * Keying off invoiced_at made a paid-but-not-yet-activated event look like it had
 * already run, which locked it to "Archived" and made it impossible to activate
 * the very event the customer had just paid for.
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
