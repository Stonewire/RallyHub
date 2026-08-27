import { i18n } from '@/lib/i18n'
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
  if (status === 'refunded') return i18n.t('admin:billing.statusRefunded')
  return 'Unpaid'
}

export function invoiceStatusTone(
  status: InvoiceStatus,
): 'paid' | 'unpaid' | 'draft' {
  if (status === 'paid') return 'paid'
  // Neither owed nor collected: comped and refunded both get the neutral tone.
  if (status === 'comped' || status === 'refunded') return 'draft'
  return 'unpaid'
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
