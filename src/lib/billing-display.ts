import { formatEur, formatPlanLabel } from '@/lib/subscription-plans'
import type { Tables } from '@/types/helpers'

export type InvoiceStatus = Tables<'invoices'>['status']

export function formatInvoiceDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function formatEventDate(iso: string | null | undefined): string {
  if (!iso) return 'Date not set'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function invoiceStatusLabel(status: InvoiceStatus): string {
  if (status === 'paid') return 'Paid'
  if (status === 'comped') return 'Comped'
  return 'Unpaid'
}

export function invoiceStatusTone(
  status: InvoiceStatus,
): 'active' | 'draft' | 'ready' | 'archived' {
  if (status === 'paid') return 'active'
  if (status === 'comped') return 'ready'
  return 'draft'
}

export function formatInvoiceAmountLine(invoice: {
  amount: number
  discount: number
  amount_due: number
  status: InvoiceStatus
  plan_key: string
}): string {
  if (invoice.status === 'comped') {
    if (invoice.amount > 0 && invoice.discount > 0) {
      return `${formatEur(invoice.amount)} − ${formatEur(invoice.discount)} discount → ${formatEur(0)}`
    }
    return 'Included (100% discount)'
  }
  return formatEur(invoice.amount_due)
}

export function formatInvoicePlanLine(
  planKey: string,
  amount: number,
  extraTeamCount = 0,
  extraTeamFee = 0,
): string {
  const base = `${formatPlanLabel(planKey)} · ${formatEur(amount - extraTeamFee)} event fee`
  if (extraTeamCount <= 0) return base
  return `${base} · ${extraTeamCount} extra team${extraTeamCount === 1 ? '' : 's'} (${formatEur(extraTeamFee)})`
}

export function sumUnpaidDue(
  invoices: { status: InvoiceStatus; amount_due: number }[],
): number {
  return invoices
    .filter((i) => i.status === 'unpaid')
    .reduce((sum, i) => sum + Number(i.amount_due), 0)
}
