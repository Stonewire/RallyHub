import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { payWithPaddle } from '@/lib/paddle'
import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/helpers'
import { useOptionalTenant } from '@/contexts/tenant-context'
import { demoBillingRequest } from '@/lib/demo-sandbox'

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
        supabase.from('organizations').select('id, name, is_demo').in('id', orgIds),
        supabase.from('events').select('id, name, event_date').in('id', eventIds),
      ])

      const orgMap = new Map((orgsRes.data ?? []).map((o) => [o.id, o.name]))
      const eventMap = new Map((eventsRes.data ?? []).map((e) => [e.id, e]))
      // Demo orgs get seeded invoices on purpose, so their own billing screen
      // has something in it. None of it is real, so it never reaches Payments.
      const demoOrgIds = new Set(
        (orgsRes.data ?? []).filter((o) => o.is_demo).map((o) => o.id),
      )
      return rows
        .filter((inv) => !demoOrgIds.has(inv.organization_id))
        .map((inv) => ({
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

/**
 * Pays an unpaid per-event invoice via Paddle: creates a transaction for its
 * exact amount_due, opens the overlay checkout, and (on completion) refetches
 * this org's invoices. The webhook remains the authoritative source that
 * actually marks the invoice paid; this refetch is just for prompt UI feedback.
 */
export function usePayEventInvoiceWithPaddle(organizationId: string | null | undefined) {
  const qc = useQueryClient()
  const isDemo = useOptionalTenant()?.tenantOrg?.is_demo === true
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      if (!organizationId) throw new Error('No organization selected.')
      if (isDemo) {
        const prepared = await demoBillingRequest<{ transactionId: string }>(organizationId, {
          kind: 'event', invoiceId,
        })
        const result = await payWithPaddle(prepared.transactionId)
        if (result === 'completed') {
          await demoBillingRequest(organizationId, {
            kind: 'event_complete',
            invoiceId,
            transactionId: prepared.transactionId,
          })
        }
        return result
      }
      const { data, error } = await supabase.functions.invoke('paddle-checkout', {
        body: { organizationId, kind: 'event', invoiceId },
      })
      if (error) {
        let msg = 'Could not start payment. Please try again.'
        try {
          const errBody = await (
            error as { context?: { json?: () => Promise<{ error?: string }> } }
          ).context?.json?.()
          if (errBody?.error) msg = errBody.error
        } catch {
          /* ignore — fall back to the generic message */
        }
        throw new Error(msg)
      }
      const transactionId = (data as { transactionId?: string } | null)?.transactionId
      if (!transactionId) throw new Error('Payment could not be started.')
      return payWithPaddle(transactionId)
    },
    onSuccess: (result) => {
      if (result === 'completed') {
        void qc.invalidateQueries({ queryKey: queryKeys.organizationInvoices(organizationId ?? null) })
      }
    },
  })
}

export function partitionInvoices(invoices: EventInvoiceWithEvent[]) {
  // P6.4: superseded invoices (earlier runs of a recurring event) stay in the
  // settled history but never count as owed. The restart RPC refuses to
  // supersede an unpaid invoice, so this filter cannot hide real debt.
  const unpaid = invoices
    .filter((i) => i.status === 'unpaid' && !i.superseded)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const settled = invoices
    .filter((i) => i.status === 'paid' || i.status === 'comped')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  return { unpaid, settled }
}
