import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/helpers'

export type SupportTicketRow = Tables<'support_tickets'>

export function useRallyHubDashboard() {
  return useQuery({
    queryKey: ['rallyhub', 'dashboard'],
    queryFn: async () => {
      const [orgsRes, eventsRes, activeRes] = await Promise.all([
        supabase.from('organizations').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
      ])
      if (orgsRes.error) throw orgsRes.error
      if (eventsRes.error) throw eventsRes.error
      if (activeRes.error) throw activeRes.error
      return {
        clientCount: orgsRes.count ?? 0,
        totalEvents: eventsRes.count ?? 0,
        activeEvents: activeRes.count ?? 0,
      }
    },
  })
}

export function useRallyHubClients() {
  return useQuery({
    queryKey: ['rallyhub', 'clients'],
    queryFn: async () => {
      const { data: orgs, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name')
      if (error) throw error

      const { data: events } = await supabase.from('events').select('organization_id, status')

      return (orgs ?? []).map((org) => {
        const orgEvents = (events ?? []).filter((e) => e.organization_id === org.id)
        return {
          ...org,
          completedEvents: orgEvents.filter((e) => e.status === 'archived').length,
          upcomingEvents: orgEvents.filter(
            (e) => e.status === 'ready' || e.status === 'draft',
          ).length,
        }
      })
    },
  })
}

export function useRallyHubClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['rallyhub', 'client', clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const { data: org, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', clientId!)
        .single()
      if (error) throw error

      const [members, events] = await Promise.all([
        supabase
          .from('organization_members')
          .select('*')
          .eq('organization_id', clientId!),
        supabase.from('events').select('*').eq('organization_id', clientId!),
      ])

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('organization_id', clientId!)

      return {
        org,
        members: members.data ?? [],
        events: events.data ?? [],
        profiles: profiles ?? [],
      }
    },
  })
}

export function useUpdateClientNotes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      orgId,
      notes,
      account_status,
    }: {
      orgId: string
      notes: string
      account_status?: string
    }) => {
      const { error } = await supabase
        .from('organizations')
        .update({
          internal_notes: notes,
          ...(account_status ? { account_status } : {}),
        })
        .eq('id', orgId)
      if (error) throw error
    },
    onSuccess: (_, { orgId }) => {
      void qc.invalidateQueries({ queryKey: ['rallyhub', 'client', orgId] })
      void qc.invalidateQueries({ queryKey: ['rallyhub', 'clients'] })
    },
  })
}

export function useSupportTickets() {
  return useQuery({
    queryKey: ['rallyhub', 'support'],
    queryFn: async (): Promise<SupportTicketRow[]> => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
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
      status: string
    }) => {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status })
        .eq('id', ticketId)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rallyhub', 'support'] })
    },
  })
}

export function useReplyToTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ticketId,
      body,
    }: {
      ticketId: string
      body: string
    }) => {
      const { error } = await supabase.from('support_ticket_replies').insert({
        ticket_id: ticketId,
        body,
        is_staff: true,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rallyhub', 'support'] })
    },
  })
}

export function usePlatformGames() {
  return useQuery({
    queryKey: ['rallyhub', 'platform-games'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('is_platform_template', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}
