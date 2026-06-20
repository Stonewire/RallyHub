import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/helpers'

export type EventInvoiceWithEvent = Tables<'invoices'> & {
  event: Pick<
    Tables<'events'>,
    'id' | 'name' | 'event_date' | 'team_count' | 'status'
  > | null
}

export function useOrganizationInvoices(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.organizationInvoices(organizationId ?? null),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<EventInvoiceWithEvent[]> => {
      if (!organizationId) return []

      const { data: invoices, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (invoiceError) throw invoiceError
      if (!invoices?.length) return []

      const eventIds = [...new Set(invoices.map((i) => i.event_id))]
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, name, event_date, team_count, status')
        .in('id', eventIds)

      if (eventsError) throw eventsError

      const eventsById = new Map((events ?? []).map((e) => [e.id, e]))

      return invoices.map((invoice) => ({
        ...invoice,
        event: eventsById.get(invoice.event_id) ?? null,
      }))
    },
  })
}

export type InvoiceWithOrgAndEvent = Tables<'invoices'> & {
  org_name: string
  event_name: string
  event_date: string | null
}

const allInvoicesKey = ['rallyhub', 'all-invoices'] as const

export function useAllInvoices() {
  return useQuery({
    queryKey: allInvoicesKey,
    queryFn: async (): Promise<InvoiceWithOrgAndEvent[]> => {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = invoices ?? []
      if (!rows.length) return []

      const orgIds = [...new Set(rows.map((i) => i.organization_id))]
      const eventIds = [...new Set(rows.map((i) => i.event_id))]
      const [orgsRes, eventsRes] = await Promise.all([
        supabase.from('organizations').select('id, name').in('id', orgIds),
        supabase.from('events').select('id, name, event_date').in('id', eventIds),
      ])

      const orgMap = new Map((orgsRes.data ?? []).map((o) => [o.id, o.name]))
      const eventMap = new Map((eventsRes.data ?? []).map((e) => [e.id, e]))
      return rows.map((inv) => ({
        ...inv,
        org_name: orgMap.get(inv.organization_id) ?? inv.organization_id,
        event_name: eventMap.get(inv.event_id)?.name ?? 'Unknown event',
        event_date: eventMap.get(inv.event_id)?.event_date ?? null,
      }))
    },
  })
}

export function useMarkInvoiceStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'paid' | 'comped' | 'unpaid' }) => {
      const { error } = await supabase.from('invoices').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: allInvoicesKey })
      void qc.invalidateQueries({ queryKey: ['organization-invoices'] })
    },
  })
}

export function partitionInvoices(invoices: EventInvoiceWithEvent[]) {
  const unpaid = invoices
    .filter((i) => i.status === 'unpaid')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const settled = invoices
    .filter((i) => i.status === 'paid' || i.status === 'comped')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  return { unpaid, settled }
}
