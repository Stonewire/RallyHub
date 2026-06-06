export type SupportViewerRole = 'client' | 'support'

export function supportListKey(scope: 'all' | 'org', organizationId?: string) {
  return scope === 'all'
    ? (['support', 'tickets', 'all'] as const)
    : (['support', 'tickets', 'org', organizationId] as const)
}

export function messagesKey(ticketId: string) {
  return ['support', 'messages', ticketId] as const
}

export function supportUnreadKey(viewerRole: SupportViewerRole) {
  return ['support', 'unread', viewerRole] as const
}

export function supportTicketUnreadKey(viewerRole: SupportViewerRole) {
  return ['support', 'unread', 'by-ticket', viewerRole] as const
}
