import { useQuery } from '@tanstack/react-query'

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

export function partitionInvoices(invoices: EventInvoiceWithEvent[]) {
  const unpaid = invoices
    .filter((i) => i.status === 'unpaid')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const settled = invoices
    .filter((i) => i.status === 'paid' || i.status === 'comped')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  return { unpaid, settled }
}
