import { CreditCard, Download } from 'lucide-react'

import { NeoButton } from '@/components/neo-minimal'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { Card } from '@/components/ui/card'
import type { EventInvoiceWithEvent } from '@/hooks/use-billing-invoices'
import {
  formatEventDate,
  formatInvoiceAmountLine,
  formatInvoiceDate,
  formatInvoicePlanLine,
  invoiceStatusLabel,
  invoiceStatusTone,
} from '@/lib/billing-display'
import { cn } from '@/lib/utils'

type EventInvoiceRowProps = {
  invoice: EventInvoiceWithEvent
  showPayIndicator?: boolean
  /** When provided, unpaid invoices get a "Pay now" button instead of a static badge. */
  onPay?: (invoiceId: string) => void
  payingInvoiceId?: string | null
  /** When provided, paid invoices get an "Invoice" button to open Paddle's PDF. */
  onDownload?: (invoiceId: string) => void
  downloadingInvoiceId?: string | null
}

export function EventInvoiceRow({
  invoice,
  showPayIndicator = false,
  onPay,
  payingInvoiceId = null,
  onDownload,
  downloadingInvoiceId = null,
}: EventInvoiceRowProps) {
  // Paddle only issues a PDF for a real transaction. Comped/€0 events never had
  // one, so there is nothing to download for them.
  const canDownload =
    Boolean(onDownload) && invoice.status === 'paid' && Boolean(invoice.paddle_transaction_id)
  const eventName = invoice.event?.name ?? 'Unknown event'
  const eventDate = invoice.event?.event_date ?? null
  const teamCount = invoice.event?.team_count ?? 0

  return (
    <article className="border-border/80 bg-card flex flex-col gap-2 rounded-lg border p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-foreground truncate text-sm font-medium">{eventName}</p>
          <StatusIndicator
            status={invoiceStatusTone(invoice.status)}
            className="shrink-0"
          />
          <span className="text-muted-foreground text-xs">
            {invoiceStatusLabel(invoice.status)}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          {formatEventDate(eventDate)} · {teamCount} team{teamCount === 1 ? '' : 's'}
        </p>
        <p className="text-muted-foreground text-xs">
          {formatInvoicePlanLine(
            invoice.plan_key,
            Number(invoice.amount),
            invoice.extra_team_count ?? 0,
            Number(invoice.extra_team_fee ?? 0),
          )}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
        <p className="text-foreground text-sm font-semibold tabular-nums">
          {formatInvoiceAmountLine({
            amount: Number(invoice.amount),
            discount: Number(invoice.discount),
            amount_due: Number(invoice.amount_due),
            status: invoice.status,
            plan_key: invoice.plan_key,
          })}
        </p>
        <p className="text-muted-foreground text-xs">
          Invoiced {formatInvoiceDate(invoice.created_at)}
        </p>
        {canDownload ? (
          <NeoButton
            variant="surface"
            size="sm"
            onClick={() => onDownload?.(invoice.id)}
            disabled={downloadingInvoiceId === invoice.id}
          >
            <Download className="size-3.5" aria-hidden />
            {downloadingInvoiceId === invoice.id ? 'Opening…' : 'Invoice'}
          </NeoButton>
        ) : null}
        {showPayIndicator && invoice.status === 'unpaid' ? (
          onPay ? (
            <NeoButton
              variant="accent"
              size="sm"
              onClick={() => onPay(invoice.id)}
              disabled={payingInvoiceId === invoice.id}
            >
              <CreditCard className="size-3.5" aria-hidden />
              {payingInvoiceId === invoice.id ? 'Opening checkout…' : 'Pay now'}
            </NeoButton>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                'border border-primary text-primary bg-transparent',
              )}
            >
              <CreditCard className="size-3" aria-hidden />
              Payment required
            </span>
          )
        ) : null}
      </div>
    </article>
  )
}


type EventInvoiceListProps = {
  invoices: EventInvoiceWithEvent[]
  emptyMessage: string
  showPayIndicator?: boolean
  onPay?: (invoiceId: string) => void
  payingInvoiceId?: string | null
  onDownload?: (invoiceId: string) => void
  downloadingInvoiceId?: string | null
}

export function EventInvoiceList({
  invoices,
  emptyMessage,
  showPayIndicator = false,
  onPay,
  payingInvoiceId = null,
  onDownload,
  downloadingInvoiceId = null,
}: EventInvoiceListProps) {
  if (invoices.length === 0) {
    return (
      <Card className="border-border/80 bg-muted/20 px-4 py-8 text-center shadow-sm">
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {invoices.map((invoice) => (
        <EventInvoiceRow
          key={invoice.id}
          invoice={invoice}
          showPayIndicator={showPayIndicator}
          onPay={onPay}
          payingInvoiceId={payingInvoiceId}
          onDownload={onDownload}
          downloadingInvoiceId={downloadingInvoiceId}
        />
      ))}
    </div>
  )
}
