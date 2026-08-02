import { useState } from 'react'
import { Link } from 'react-router-dom'

import { IconCheck, IconRefresh } from '@/components/icons'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { NeoButton, NeoCard, NeoStatusBadge } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { useNotification } from '@/contexts/notification-context'
import {
  useAllInvoices,
  useMarkInvoiceStatus,
  type InvoiceWithOrgAndEvent,
} from '@/hooks/use-billing-invoices'
import { formatEur, formatPlanLabel } from '@/lib/subscription-plans'
import { formatInvoiceDate, formatEventDate } from '@/lib/billing-display'

type SettledFilter = 'all' | 'paid' | 'comped'

function amountLine(invoice: InvoiceWithOrgAndEvent): string {
  if (invoice.status === 'comped') {
    return `€0 (comped, was ${formatEur(Number(invoice.amount))})`
  }
  if (invoice.discount > 0) {
    return `${formatEur(Number(invoice.amount_due))} (${formatEur(Number(invoice.amount))} − ${formatEur(Number(invoice.discount))})`
  }
  return formatEur(Number(invoice.amount_due))
}

function InvoiceMeta({ invoice }: { invoice: InvoiceWithOrgAndEvent }) {
  const teamChargeLine =
    (invoice.extra_team_count ?? 0) > 0
      ? `${invoice.extra_team_count} additional team${invoice.extra_team_count === 1 ? '' : 's'} · ${formatEur(Number(invoice.extra_team_fee ?? 0))}`
      : null
  return (
    <div className="min-w-0 flex-1 space-y-0.5">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`/admin/clients/${invoice.organization_id}`}
          className="text-foreground text-sm font-semibold hover:underline"
        >
          {invoice.org_name}
        </Link>
        <NeoStatusBadge
          tone={
            invoice.status === 'paid' ? 'paid' : invoice.status === 'unpaid' ? 'unpaid' : 'draft'
          }
        >
          {invoice.status}
        </NeoStatusBadge>
      </div>
      <p className="text-muted-foreground text-xs">
        {invoice.event_name}
        {invoice.event_date ? ` · ${formatEventDate(invoice.event_date)}` : ''} ·{' '}
        {formatPlanLabel(invoice.plan_key)} plan
      </p>
      <p className="text-muted-foreground text-xs">
        Invoiced {formatInvoiceDate(invoice.created_at)}
      </p>
      {teamChargeLine ? <p className="text-muted-foreground text-xs">{teamChargeLine}</p> : null}
    </div>
  )
}

/**
 * Payments, split by what a super admin does with it: the left column is the
 * work queue (unpaid invoices, with the one action this page owns), the right
 * column is reference (totals, then everything already settled).
 */
export function RallyHubPaymentsPage() {
  const { notify } = useNotification()
  const invoicesQuery = useAllInvoices()
  const markStatus = useMarkInvoiceStatus()
  const [settledFilter, setSettledFilter] = useState<SettledFilter>('all')

  const invoices = invoicesQuery.data ?? []
  const unpaid = invoices.filter((i) => i.status === 'unpaid')
  const settled = invoices.filter((i) => i.status !== 'unpaid')
  const filteredSettled =
    settledFilter === 'all' ? settled : settled.filter((i) => i.status === settledFilter)
  const outstanding = unpaid.reduce((sum, i) => sum + Number(i.amount_due), 0)
  const collected = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.amount_due), 0)

  async function handleMarkPaid(id: string) {
    try {
      await markStatus.mutateAsync({ id, status: 'paid' })
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not mark invoice paid')
    }
  }

  const SETTLED_FILTERS: { label: string; value: SettledFilter }[] = [
    { label: 'All', value: 'all' },
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
        <div className="space-y-4">
          {/* Even top split: the queue on the left, the totals on the right. */}
          <div className="grid items-stretch gap-4 lg:grid-cols-2">
          {/* Work queue: the only rows with an action on them. */}
          <Card className="border-border/80 bg-card p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-foreground text-sm font-bold">Needs action</h2>
              <span className="text-muted-foreground text-xs">
                {unpaid.length} unpaid · {formatEur(outstanding)}
              </span>
            </div>
            {unpaid.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Nothing owed. Every invoice is settled.
              </p>
            ) : (
              <ul>
                {unpaid.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="border-border/80 flex flex-wrap items-center gap-3 border-b py-3 last:border-0"
                  >
                    <InvoiceMeta invoice={invoice} />
                    <div className="flex shrink-0 items-center gap-3">
                      <p className="text-foreground text-sm font-semibold tabular-nums">
                        {amountLine(invoice)}
                      </p>
                      <NeoButton
                        type="button"
                        size="sm"
                        variant="accent"
                        disabled={markStatus.isPending}
                        onClick={() => void handleMarkPaid(invoice.id)}
                      >
                        <IconCheck className="size-3.5" />
                        Mark paid
                      </NeoButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

            {/* Reference: the two totals. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <NeoCard className="flex flex-col justify-center p-6">
                <p className="text-nm-neutral-500 mb-1 text-[10px] font-semibold tracking-wider uppercase">
                  Outstanding
                </p>
                <p className="text-4xl font-bold tabular-nums">{formatEur(outstanding)}</p>
                <p className="text-nm-neutral-500 mt-1 text-xs">Unpaid event invoices</p>
              </NeoCard>
              <NeoCard className="flex flex-col justify-center p-6">
                <p className="text-nm-neutral-500 mb-1 text-[10px] font-semibold tracking-wider uppercase">
                  Collected
                </p>
                <p className="text-4xl font-bold tabular-nums">{formatEur(collected)}</p>
                <p className="text-nm-neutral-500 mt-1 text-xs">Paid event invoices</p>
              </NeoCard>
            </div>
          </div>

          {/* The full history, end to end underneath. */}
          <Card className="border-border/80 bg-card p-6 shadow-sm">
              <div className="border-border/70 mb-4 flex flex-wrap items-center gap-2 border-b pb-4">
                {SETTLED_FILTERS.map((f) => {
                  const count =
                    f.value === 'all'
                      ? settled.length
                      : settled.filter((i) => i.status === f.value).length
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setSettledFilter(f.value)}
                      className={`h-9 rounded-full border px-4 text-xs font-semibold transition-colors ${
                        settledFilter === f.value
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
              {filteredSettled.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No {settledFilter === 'all' ? 'settled' : settledFilter} invoices.
                </p>
              ) : (
                <ul>
                  {filteredSettled.map((invoice) => (
                    <li
                      key={invoice.id}
                      className="border-border/80 flex flex-wrap items-center gap-3 border-b py-3 last:border-0"
                    >
                      <InvoiceMeta invoice={invoice} />
                      <p className="text-foreground shrink-0 text-sm font-semibold tabular-nums">
                        {amountLine(invoice)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
          </Card>
        </div>
      )}
    </AdminPageShell>
  )
}
