type EventLike = {
  status: string
}

export function countClientEvents(events: EventLike[]) {
  return {
    completedEvents: events.filter((e) => e.status === 'archived').length,
    upcomingEvents: events.filter(
      (e) => e.status === 'ready' || e.status === 'draft',
    ).length,
  }
}
