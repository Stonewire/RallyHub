import { useState } from 'react'
import { Link } from 'react-router-dom'

import { IconBilling, IconCheck, IconRefresh } from '@/components/icons'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { NeoButton } from '@/components/neo-minimal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
          {/* One label: the indicator prints its own unless given one, which
              is how "Ready Comped" happened. */}
          <StatusIndicator status={invoiceStatusTone(invoice.status)} label={invoice.status} />
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
            <IconCheck className="size-3.5" />
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
  const unpaidCount = invoices.filter((i) => i.status === 'unpaid').length
  const paidCount = invoices.filter((i) => i.status === 'paid').length

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
    <AdminPageShell
      title="Payments"
      subtitle="All event invoices across clients."
      actions={
        <NeoButton
          type="button"
          variant="surface"
          disabled={invoicesQuery.isFetching}
          onClick={() => void invoicesQuery.refetch()}
        >
          <IconRefresh className={`size-4 ${invoicesQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </NeoButton>
      }
    >
      {invoicesQuery.isLoading ? (
        <QueryLoading rows={4} />
      ) : invoicesQuery.isError ? (
        <QueryError message={invoicesQuery.error.message} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Outstanding"
              value={formatEur(outstanding)}
              hint={`${unpaidCount} unpaid invoice${unpaidCount === 1 ? '' : 's'}`}
            />
            <StatTile
              label="Collected"
              value={formatEur(collected)}
              hint={`${paidCount} paid`}
            />
            <StatTile label="Comped" value={compedCount} hint="Free activations" />
          </div>

          <Card className="border-border/80 bg-card p-6 shadow-sm">
            {/* Pill filters, same as every other list in the panel. */}
            <div className="border-border/70 mb-4 flex flex-wrap items-center gap-2 border-b pb-4">
              {FILTERS.map((f) => {
                const count =
                  f.value === 'all'
                    ? invoices.length
                    : invoices.filter((i) => i.status === f.value).length
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFilter(f.value)}
                    className={`h-9 rounded-full border px-4 text-xs font-semibold transition-colors ${
                      filter === f.value
                        ? 'border-nm-slate-800 bg-nm-slate-800 dark:border-nm-slate-700 dark:bg-nm-slate-700 text-white'
                        : 'border-border bg-card text-muted-foreground hover:border-nm-slate-400 hover:text-foreground'
                    }`}
                  >
                    {f.label}
                    <span className="ml-1.5 tabular-nums">({count})</span>
                  </button>
                )
              })}
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
          </Card>
        </div>
      )}
    </AdminPageShell>
  )
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: number | string
  hint?: string
}) {
  return (
    <Card className="neo-card border-border/80 bg-card text-card-foreground shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="neo-stat-label text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {label}
        </CardTitle>
        <IconBilling aria-hidden className="text-muted-foreground size-5 opacity-75" />
      </CardHeader>
      <CardContent>
        <p className="neo-stat-value text-foreground text-[1.75rem] leading-none font-bold tracking-tight tabular-nums sm:text-[2rem]">
          {value}
        </p>
        {hint ? <p className="text-muted-foreground mt-2 text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
