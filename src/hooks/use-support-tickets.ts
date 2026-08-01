import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'

import { useAuth } from '@/contexts/auth-context'
import { generateSupportTicketNumber } from '@/lib/support-ticket'
import {
  appendSupportMessageToCache,
  subscribeSupportRealtime,
} from '@/lib/support-realtime'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/helpers'

import {
  messagesKey,
  supportListKey,
  supportTicketUnreadKey,
  supportUnreadKey,
  type SupportViewerRole,
} from './support-query-keys'

export type SupportTicketRow = Tables<'support_tickets'>
export type SupportTicketMessageRow = Tables<'support_ticket_messages'>
export type { SupportViewerRole } from './support-query-keys'
export { supportUnreadKey } from './support-query-keys'

export const TICKET_STATUS_ORDER = ['open', 'in_progress', 'resolved'] as const
export type TicketStatus = (typeof TICKET_STATUS_ORDER)[number]

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
}

export function groupTicketsByStatus(tickets: SupportTicketRow[]) {
  return TICKET_STATUS_ORDER.map((status) => ({
    status,
    label: TICKET_STATUS_LABELS[status],
    tickets: tickets.filter((t) => t.status === status),
  }))
}

export function useSupportRealtimeSync(viewerRole: SupportViewerRole) {
  const { user } = useAuth()
  const qc = useQueryClient()

  useEffect(() => {
    if (!user) return
    return subscribeSupportRealtime(user.id, viewerRole, qc)
  }, [user, viewerRole, qc])
}

export function useSupportUnreadCount(viewerRole: SupportViewerRole) {
  const { user } = useAuth()
  useSupportRealtimeSync(viewerRole)

  return useQuery({
    queryKey: supportUnreadKey(viewerRole),
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('support_unread_ticket_count', {
        p_viewer_role: viewerRole,
      })
      if (error) throw error
      return data ?? 0
    },
    enabled: Boolean(user),
    refetchInterval: 60_000,
  })
}

export type SupportTicketUnreadMap = Record<string, number>

export function useSupportTicketUnreadCounts(viewerRole: SupportViewerRole) {
  const { user } = useAuth()
  useSupportRealtimeSync(viewerRole)

  return useQuery({
    queryKey: supportTicketUnreadKey(viewerRole),
    queryFn: async (): Promise<SupportTicketUnreadMap> => {
      const { data, error } = await supabase.rpc('support_unread_counts_by_ticket', {
        p_viewer_role: viewerRole,
      })
      if (error) throw error
      const map: SupportTicketUnreadMap = {}
      for (const row of data ?? []) {
        map[row.ticket_id] = row.unread_count
      }
      return map
    },
    enabled: Boolean(user),
    refetchInterval: 60_000,
  })
}

export function useMarkSupportTicketRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ticketId,
      viewerRole,
    }: {
      ticketId: string
      viewerRole: SupportViewerRole
    }) => {
      const { error } = await supabase.rpc('mark_support_ticket_read', {
        p_ticket_id: ticketId,
        p_viewer_role: viewerRole,
      })
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      qc.setQueryData<SupportTicketUnreadMap>(
        supportTicketUnreadKey(vars.viewerRole),
        (prev) => {
          if (!prev) return prev
          const next = { ...prev }
          delete next[vars.ticketId]
          return next
        },
      )
      void qc.invalidateQueries({ queryKey: supportUnreadKey(vars.viewerRole) })
      void qc.invalidateQueries({ queryKey: supportTicketUnreadKey(vars.viewerRole) })
    },
  })
}

export function useSupportTickets(scope: 'all' | 'org' = 'all', organizationId?: string) {
  return useQuery({
    queryKey: supportListKey(scope, organizationId),
    queryFn: async (): Promise<SupportTicketRow[]> => {
      let q = supabase.from('support_tickets').select('*').order('updated_at', { ascending: false })
      if (scope === 'org' && organizationId) {
        q = q.eq('organization_id', organizationId)
      }
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    enabled: scope === 'all' || Boolean(organizationId),
  })
}

export function useTicketMessages(ticketId: string | undefined) {
  const reload = useCallback(async () => {
    if (!ticketId) return []
    const { data, error } = await supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  }, [ticketId])

  return useQuery({
    queryKey: ticketId ? messagesKey(ticketId) : ['support', 'messages', 'none'],
    queryFn: reload,
    enabled: Boolean(ticketId),
    staleTime: Infinity,
  })
}

export function useUpdateTicketStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ticketId,
      status,
    }: {
      ticketId: string
      status: TicketStatus
    }) => {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', ticketId)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['support', 'tickets'] })
    },
  })
}

export function useSendTicketMessage() {
  const qc = useQueryClient()
  const { profile } = useAuth()

  return useMutation({
    mutationFn: async ({
      ticketId,
      body,
      senderRole,
      senderName,
    }: {
      ticketId: string
      body: string
      senderRole: 'client' | 'support'
      senderName?: string
    }) => {
      const name =
        senderName?.trim() ||
        (senderRole === 'support'
          ? profile?.full_name?.trim() || 'RallyHub Support'
          : profile?.full_name?.trim() || 'Client')
      const { data, error } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: ticketId,
          sender_role: senderRole,
          sender_name: name,
          body: body.trim(),
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (row, vars) => {
      appendSupportMessageToCache(qc, vars.ticketId, row)
      void qc.invalidateQueries({ queryKey: ['support', 'tickets'] })
    },
  })
}

/** @deprecated Prefer useSendTicketMessage — kept for legacy imports. */
export function useReplyToTicket() {
  const send = useSendTicketMessage()
  return {
    ...send,
    mutateAsync: (vars: { ticketId: string; body: string }) =>
      send.mutateAsync({
        ticketId: vars.ticketId,
        body: vars.body,
        senderRole: 'support',
      }),
    mutate: (vars: { ticketId: string; body: string }) =>
      send.mutate({
        ticketId: vars.ticketId,
        body: vars.body,
        senderRole: 'support',
      }),
  }
}

export function useCreateSupportTicket(organizationId: string | undefined) {
  const qc = useQueryClient()
  const { profile } = useAuth()

  return useMutation({
    mutationFn: async ({
      subject,
      body,
      category,
    }: {
      subject: string
      body: string
      category?: string
    }) => {
      if (!organizationId) throw new Error('No organization')
      const ticketNumber = generateSupportTicketNumber()
      const trimmedBody = body.trim()
      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          organization_id: organizationId,
          subject: subject.trim(),
          body: trimmedBody || null,
          category: category?.trim() || null,
          ticket_number: ticketNumber,
          status: 'open',
        })
        .select()
        .single()
      if (error) throw error
      if (trimmedBody) {
        const { data: message, error: msgError } = await supabase
          .from('support_ticket_messages')
          .insert({
            ticket_id: ticket.id,
            sender_role: 'client',
            sender_name: profile?.full_name?.trim() || 'Client',
            body: trimmedBody,
          })
          .select()
          .single()
        if (msgError) throw msgError
        if (message) appendSupportMessageToCache(qc, ticket.id, message)
      }
      return { ticket, ticketNumber }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['support', 'tickets'] })
    },
  })
}
