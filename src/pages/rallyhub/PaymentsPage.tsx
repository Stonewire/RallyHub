import { Check, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { NeoButton, NeoCard, NeoPageShell } from '@/components/neo-minimal'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { useNotification } from '@/contexts/notification-context'
import {
  useAllInvoices,
  useMarkInvoiceStatus,
  type InvoiceWithOrgAndEvent,
} from '@/hooks/use-billing-invoices'
import {
  formatEur,
  formatPlanLabel,
} from '@/lib/subscription-plans'
import {
  formatInvoiceDate,
  formatEventDate,
  invoiceStatusTone,
} from '@/lib/billing-display'

type StatusFilter = 'all' | 'unpaid' | 'paid' | 'comped'

function InvoiceRow({
  invoice,
  onMarkPaid,
  marking,
}: {
  invoice: InvoiceWithOrgAndEvent
  onMarkPaid: (id: string) => void
  marking: boolean
}) {
  const amountLine =
    invoice.status === 'comped'
      ? `€0 (comped, was ${formatEur(Number(invoice.amount))})`
      : invoice.discount > 0
        ? `${formatEur(Number(invoice.amount_due))} (${formatEur(Number(invoice.amount))} − ${formatEur(Number(invoice.discount))})`
        : formatEur(Number(invoice.amount_due))
  const teamChargeLine = (invoice.extra_team_count ?? 0) > 0
    ? `${invoice.extra_team_count} additional team${invoice.extra_team_count === 1 ? '' : 's'} · ${formatEur(Number(invoice.extra_team_fee ?? 0))}`
    : null

  return (
    <li className="border-border/80 flex flex-wrap items-center gap-3 border-b py-3 last:border-0">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/admin/clients/${invoice.organization_id}`}
            className="text-foreground text-sm font-semibold hover:underline"
          >
            {invoice.org_name}
          </Link>
          <StatusIndicator status={invoiceStatusTone(invoice.status)} />
          <span className="text-muted-foreground text-xs capitalize">{invoice.status}</span>
        </div>
        <p className="text-muted-foreground text-xs">
          {invoice.event_name}
          {invoice.event_date ? ` · ${formatEventDate(invoice.event_date)}` : ''} ·{' '}
          {formatPlanLabel(invoice.plan_key)} plan
        </p>
        <p className="text-muted-foreground text-xs">
          Invoiced {formatInvoiceDate(invoice.created_at)}
        </p>
        {teamChargeLine ? (
          <p className="text-muted-foreground text-xs">{teamChargeLine}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <p className="text-foreground text-sm font-semibold tabular-nums">{amountLine}</p>
        {invoice.status === 'unpaid' ? (
          <NeoButton
            type="button"
            size="sm"
            variant="surface"
            disabled={marking}
            onClick={() => onMarkPaid(invoice.id)}
          >
            <Check className="size-3.5" />
            Mark paid
          </NeoButton>
        ) : null}
      </div>
    </li>
  )
}

export function RallyHubPaymentsPage() {
  const { notify } = useNotification()
  const invoicesQuery = useAllInvoices()
  const markStatus = useMarkInvoiceStatus()
  const [filter, setFilter] = useState<StatusFilter>('all')

  const invoices = invoicesQuery.data ?? []
  const outstanding = invoices
    .filter((i) => i.status === 'unpaid')
    .reduce((s, i) => s + Number(i.amount_due), 0)
  const collected = invoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + Number(i.amount_due), 0)
  const compedCount = invoices.filter((i) => i.status === 'comped').length

  const filtered = filter === 'all' ? invoices : invoices.filter((i) => i.status === filter)

  async function handleMarkPaid(id: string) {
    try {
      await markStatus.mutateAsync({ id, status: 'paid' })
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not mark invoice paid')
    }
  }

  const FILTERS: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Unpaid', value: 'unpaid' },
    { label: 'Paid', value: 'paid' },
    { label: 'Comped', value: 'comped' },
  ]

  return (
    <NeoPageShell
      title="Payments"
      subtitle="All event invoices across clients."
    >
      {invoicesQuery.isLoading ? (
        <QueryLoading rows={4} />
      ) : invoicesQuery.isError ? (
        <QueryError message={invoicesQuery.error.message} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <NeoCard className="p-5">
              <p className="neo-stat-label">Outstanding</p>
              <p className="neo-stat-value mt-2 text-orange-600">{formatEur(outstanding)}</p>
              <p className="neo-stat-hint mt-1">
                {invoices.filter((i) => i.status === 'unpaid').length} unpaid invoice
                {invoices.filter((i) => i.status === 'unpaid').length === 1 ? '' : 's'}
              </p>
            </NeoCard>
            <NeoCard className="p-5">
              <p className="neo-stat-label">Collected</p>
              <p className="neo-stat-value mt-2">{formatEur(collected)}</p>
              <p className="neo-stat-hint mt-1">
                {invoices.filter((i) => i.status === 'paid').length} paid
              </p>
            </NeoCard>
            <NeoCard className="p-5">
              <p className="neo-stat-label">Comped</p>
              <p className="neo-stat-value mt-2">{compedCount}</p>
              <p className="neo-stat-hint mt-1">Free activations</p>
            </NeoCard>
          </div>

          <NeoCard className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFilter(f.value)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      filter === f.value
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {f.label}
                    {f.value !== 'all' ? (
                      <span className="ml-1.5 tabular-nums">
                        ({invoices.filter((i) => i.status === f.value).length})
                      </span>
                    ) : (
                      <span className="ml-1.5 tabular-nums">({invoices.length})</span>
                    )}
                  </button>
                ))}
              </div>
              <NeoButton
                type="button"
                variant="surface"
                size="sm"
                disabled={invoicesQuery.isFetching}
                onClick={() => void invoicesQuery.refetch()}
              >
                <RefreshCw className={`size-3.5 ${invoicesQuery.isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </NeoButton>
            </div>

            {filtered.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No {filter === 'all' ? '' : filter} invoices.
              </p>
            ) : (
              <ul>
                {filtered.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    onMarkPaid={(id) => void handleMarkPaid(id)}
                    marking={markStatus.isPending}
                  />
                ))}
              </ul>
            )}
          </NeoCard>
        </div>
      )}
    </NeoPageShell>
  )
}
