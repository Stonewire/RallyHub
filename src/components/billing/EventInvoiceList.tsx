import { IconBilling, IconDownload } from '@/components/icons'
import { useTranslation } from 'react-i18next'

import { NeoButton } from '@/components/neo-minimal'
import { NeoStatusBadge, type NeoStatusBadgeTone } from '@/components/neo-minimal'
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
  const { t } = useTranslation('admin')
  // Paddle only issues a PDF for a real transaction. Comped/€0 events never had
  // one, so there is nothing to download for them.
  const canDownload =
    Boolean(onDownload) && invoice.status === 'paid' && Boolean(invoice.paddle_transaction_id)
  const eventName = invoice.event?.name ?? t('billing.unknownEvent')
  const eventDate = invoice.event?.event_date ?? null
  const teamCount = invoice.event?.team_count ?? 0

  return (
    <article className="border-border/80 bg-card flex flex-col gap-2 rounded-lg border p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-foreground truncate text-sm font-medium">{eventName}</p>
          <NeoStatusBadge
            tone={invoiceStatusTone(invoice.status) as NeoStatusBadgeTone}
            className="shrink-0"
          >
            {invoiceStatusLabel(invoice.status)}
          </NeoStatusBadge>
        </div>
        <p className="text-muted-foreground text-xs">
          {formatEventDate(eventDate)} · {t('billing.teamCount', { count: teamCount })}
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
          {t('billing.invoicedOn', { date: formatInvoiceDate(invoice.created_at) })}
        </p>
        {canDownload ? (
          <NeoButton
            variant="surface"
            size="sm"
            onClick={() => onDownload?.(invoice.id)}
            disabled={downloadingInvoiceId === invoice.id}
          >
            <IconDownload className="size-3.5" aria-hidden />
            {downloadingInvoiceId === invoice.id ? t('billing.opening') : t('billing.invoice')}
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
              <IconBilling className="size-3.5" aria-hidden />
              {payingInvoiceId === invoice.id ? t('billing.openingCheckout') : t('billing.payNow')}
            </NeoButton>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                'border border-primary text-primary bg-transparent',
              )}
            >
              <IconBilling className="size-3.5" aria-hidden />
              {t('billing.paymentRequired')}
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
  /**
   * 'cards' keeps the detailed row used by the super-admin client view.
   * 'table' is the client Billing layout from the design: Date, Event name,
   * Total, Status. Defaults to cards so existing callers are unchanged.
   */
  layout?: 'cards' | 'table'
}

export function EventInvoiceList({
  invoices,
  emptyMessage,
  showPayIndicator = false,
  onPay,
  payingInvoiceId = null,
  onDownload,
  downloadingInvoiceId = null,
  layout = 'cards',
}: EventInvoiceListProps) {
  const { t } = useTranslation('admin')

  if (invoices.length === 0) {
    return (
      <Card className="border-border/80 bg-muted/20 px-4 py-8 text-center shadow-sm">
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      </Card>
    )
  }

  if (layout === 'table') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-muted-foreground border-border border-b text-[10px] font-semibold tracking-[0.08em] uppercase">
              <th className="py-2 pr-3 text-left font-semibold">{t('billing.tableDate')}</th>
              <th className="py-2 pr-3 text-left font-semibold">{t('billing.tableEventName')}</th>
              {/* Not the design's "Total (incl. VAT)". This number is
                  invoices.amount_due, computed by activate_event from the plan
                  price minus any promo discount; VAT is never part of that
                  calculation. Paddle is Merchant of Record and applies VAT at
                  checkout, so the VAT-inclusive figure exists only on Paddle's
                  own PDF, reachable from the Invoice button on each row.
                  Saying "excl." rather than nothing keeps the two numbers from
                  looking like a discrepancy once VAT is actually charged. */}
              <th className="py-2 pr-3 text-right font-semibold">
                {t('billing.tableTotalExclVat')}
              </th>
              <th className="py-2 pr-3 text-left font-semibold">{t('billing.tableStatus')}</th>
              <th className="py-2 text-right font-semibold">
                <span className="sr-only">{t('billing.tableActions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const canDownload =
                Boolean(onDownload) &&
                invoice.status === 'paid' &&
                Boolean(invoice.paddle_transaction_id)
              return (
                <tr key={invoice.id} className="border-border/60 border-b last:border-b-0">
                  <td className="text-muted-foreground py-2.5 pr-3 whitespace-nowrap">
                    {formatInvoiceDate(invoice.created_at)}
                  </td>
                  <td className="max-w-56 truncate py-2.5 pr-3">
                    {invoice.event?.name ?? t('billing.unknownEvent')}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                    {formatInvoiceAmountLine({
                      amount: Number(invoice.amount),
                      discount: Number(invoice.discount),
                      amount_due: Number(invoice.amount_due),
                      status: invoice.status,
                      plan_key: invoice.plan_key,
                    })}
                  </td>
                  <td className="py-2.5 pr-3">
                    <NeoStatusBadge tone={invoiceStatusTone(invoice.status) as NeoStatusBadgeTone}>
                      {invoiceStatusLabel(invoice.status)}
                    </NeoStatusBadge>
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    {showPayIndicator && invoice.status === 'unpaid' && onPay ? (
                      <NeoButton
                        variant="accent"
                        size="sm"
                        onClick={() => onPay(invoice.id)}
                        disabled={payingInvoiceId === invoice.id}
                      >
                        <IconBilling className="size-3.5" aria-hidden />
                        {payingInvoiceId === invoice.id
                          ? t('billing.opening')
                          : t('billing.payNow')}
                      </NeoButton>
                    ) : canDownload ? (
                      <button
                        type="button"
                        onClick={() => onDownload?.(invoice.id)}
                        disabled={downloadingInvoiceId === invoice.id}
                        aria-label={t('billing.downloadInvoiceFor', {
                          name: invoice.event?.name ?? t('billing.unknownEvent'),
                        })}
                        className="text-primary hover:bg-muted inline-flex size-7 items-center justify-center rounded-md disabled:opacity-50"
                      >
                        <IconDownload className="size-4" aria-hidden />
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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
