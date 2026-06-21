import type { QueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'

import {
  messagesKey,
  supportTicketUnreadKey,
  supportUnreadKey,
  type SupportViewerRole,
} from '@/hooks/support-query-keys'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/helpers'

type SupportTicketMessageRow = Tables<'support_ticket_messages'>

function appendMessage(
  qc: QueryClient,
  ticketId: string,
  row: SupportTicketMessageRow,
) {
  qc.setQueryData<SupportTicketMessageRow[]>(messagesKey(ticketId), (prev) => {
    if (!prev) return [row]
    if (prev.some((m) => m.id === row.id)) return prev
    return [...prev, row]
  })
}

function onSupportMessageInsert(
  qc: QueryClient,
  viewerRole: SupportViewerRole,
  row: SupportTicketMessageRow,
) {
  appendMessage(qc, row.ticket_id, row)
  void qc.invalidateQueries({ queryKey: ['support', 'tickets'] })
  void qc.invalidateQueries({ queryKey: supportUnreadKey(viewerRole) })
  void qc.invalidateQueries({ queryKey: supportTicketUnreadKey(viewerRole) })
}

type Subscription = {
  channel: RealtimeChannel
  refs: number
}

const subscriptions = new Map<string, Subscription>()

export function subscribeSupportRealtime(
  userId: string,
  viewerRole: SupportViewerRole,
  qc: QueryClient,
): () => void {
  const key = `${viewerRole}:${userId}`
  const existing = subscriptions.get(key)
  if (existing) {
    existing.refs += 1
    return () => releaseSupportRealtime(key)
  }

  const channel = supabase
    .channel(`support-sync:${key}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'support_ticket_messages' },
      (payload) => {
        const row = payload.new as SupportTicketMessageRow
        if (row?.ticket_id) onSupportMessageInsert(qc, viewerRole, row)
      },
    )
    .on(
      // #21: ticket status/assignment changes (e.g. admin updates status) so the
      // other side updates without a manual refresh.
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'support_tickets' },
      () => {
        void qc.invalidateQueries({ queryKey: ['support', 'tickets'] })
        void qc.invalidateQueries({ queryKey: supportUnreadKey(viewerRole) })
        void qc.invalidateQueries({ queryKey: supportTicketUnreadKey(viewerRole) })
      },
    )
    .subscribe()

  subscriptions.set(key, { channel, refs: 1 })
  return () => releaseSupportRealtime(key)
}

function releaseSupportRealtime(key: string) {
  const sub = subscriptions.get(key)
  if (!sub) return
  sub.refs -= 1
  if (sub.refs <= 0) {
    void supabase.removeChannel(sub.channel)
    subscriptions.delete(key)
  }
}

export function appendSupportMessageToCache(
  qc: QueryClient,
  ticketId: string,
  row: SupportTicketMessageRow,
) {
  appendMessage(qc, ticketId, row)
}
