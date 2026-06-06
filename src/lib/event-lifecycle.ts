import type { EventStatus } from '@/types/database'
import type { EventRow } from '@/hooks/use-events'

const ALL_STATUSES: EventStatus[] = ['active', 'ready', 'draft', 'archived']

/** True once the event has been activated and billed (invoiced_at set). */
export function isEventActivated(
  event: Pick<EventRow, 'invoiced_at'>,
): boolean {
  return event.invoiced_at != null
}

/** Status options allowed for this event given one-way activation rules. */
export function getAllowedEventStatuses(
  event: Pick<EventRow, 'status' | 'invoiced_at'>,
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
  event: Pick<EventRow, 'status' | 'invoiced_at'>,
  nextStatus: EventStatus,
): boolean {
  return getAllowedEventStatuses(event).includes(nextStatus)
}

export function eventStatusTransitionError(
  event: Pick<EventRow, 'status' | 'invoiced_at'>,
  nextStatus: EventStatus,
): string | null {
  if (canTransitionEventStatus(event, nextStatus)) return null
  if (isEventActivated(event)) {
    return 'This event has already been activated and billed. It can only be archived. Duplicate the event to run it again.'
  }
  return `Cannot change status to ${nextStatus}.`
}
