import { ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { NeoButton, NeoStatusBadge } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { useNotification } from '@/contexts/notification-context'
import {
  useCancelStoreOrder,
  useCompleteStoreOrder,
  useEventStoreOrders,
  useFulfilOrderItem,
  type InventoryOrder,
} from '@/hooks/use-inventory'
import type { Tables } from '@/types/helpers'

type StoreOrdersPanelProps = {
  eventId: string
  teams: Tables<'teams'>[]
}

function errText(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}

/**
 * Fulfilment, the way it happens at a real table: orders arrive per TEAM, the
 * facilitator opens the team, ticks items off as they hand them over, and
 * Complete both finishes the order and takes the points — nothing was
 * deducted at order time. Done orders drop into their own list so the
 * pending pile only ever shows work left to do.
 */
export function StoreOrdersPanel({ eventId, teams }: StoreOrdersPanelProps) {
  const { t } = useTranslation('facilitator')
  const { notify } = useNotification()
  const ordersQuery = useEventStoreOrders(eventId)
  const fulfilItem = useFulfilOrderItem(eventId)
  const completeOrder = useCompleteStoreOrder(eventId)
  const cancelOrder = useCancelStoreOrder(eventId)
  const [openOrderId, setOpenOrderId] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)

  const orders = ordersQuery.data ?? []
  const pending = orders.filter((o) => o.status === 'pending')
  const done = orders.filter((o) => o.status === 'done')
  const openOrder = orders.find((o) => o.id === openOrderId) ?? null

  // Nothing ordered ever: the event probably has no store, so no empty card.
  if (!ordersQuery.isSuccess || orders.length === 0) return null

  /** Points for ticked items whose points have not been taken yet. */
  const selectedPoints = (order: InventoryOrder) =>
    order.inventory_order_items
      .filter((i) => i.fulfilled && !i.completed_at)
      .reduce((sum, i) => sum + i.quantity * i.points_cost_each, 0)

  const teamName = (order: InventoryOrder) =>
    teams.find((team) => team.id === order.team_id)?.name?.trim() || t('teamFallback')

  async function complete(order: InventoryOrder) {
    try {
      const result = await completeOrder.mutateAsync(order.id)
      if (result?.order_done) {
        setOpenOrderId(null)
        notify(t('storeOrders.orderCompleted', { team: teamName(order), points: result.taken_points }))
      } else {
        // Partial hand-over: the dialog stays open with the rest still pending.
        notify(t('storeOrders.partialCompleted', { points: result?.taken_points ?? 0 }))
      }
    } catch (err) {
      notify(errText(err, t('storeOrders.completeFailed')))
    }
  }

  async function cancel(order: InventoryOrder) {
    if (!window.confirm(t('storeOrders.cancelConfirm', { team: teamName(order) }))) {
      return
    }
    try {
      await cancelOrder.mutateAsync(order.id)
      setOpenOrderId(null)
    } catch (err) {
      notify(errText(err, t('storeOrders.cancelFailed')))
    }
  }

  return (
    <Card className="neo-card border-border/80 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="size-4 text-amber-500" />
          <p className="font-medium">{t('storeOrders.heading')}</p>
        </div>
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
          {t('storeOrders.pendingCount', { count: pending.length })}
        </span>
      </div>

      {pending.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('storeOrders.emptyPending')}</p>
      ) : (
        <ul className="max-h-[32vh] space-y-2 overflow-auto">
          {pending.map((order) => (
            <li key={order.id}>
              <button
                type="button"
                className="border-border/80 hover:bg-muted/30 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
                onClick={() => setOpenOrderId(order.id)}
              >
                <div className="bg-amber-100 text-amber-900 flex size-9 shrink-0 items-center justify-center rounded-full">
                  <ShoppingBag className="size-4" />
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{teamName(order)}</p>
                  <p className="text-muted-foreground truncate">
                    {order.inventory_order_items
                      .map((i) => `${i.quantity}× ${i.item_name}`)
                      .join(', ')}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums">
                    {order.total_points} {t('common:pts')}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t('storeOrders.handedOverCount', {
                      done: order.inventory_order_items.filter((i) => i.completed_at).length,
                      total: order.inventory_order_items.length,
                    })}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
            onClick={() => setShowDone((v) => !v)}
          >
            {showDone
              ? t('storeOrders.hideDone', { count: done.length })
              : t('storeOrders.showDone', { count: done.length })}
          </button>
          {showDone ? (
            <ul className="mt-2 space-y-1.5">
              {done.map((order) => (
                <li
                  key={order.id}
                  className="border-border/60 text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {teamName(order)} ·{' '}
                    {order.inventory_order_items
                      .map((i) => `${i.quantity}× ${i.item_name}`)
                      .join(', ')}
                  </span>
                  <NeoStatusBadge tone="active">{t('storeOrders.doneBadge')}</NeoStatusBadge>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {openOrder && openOrder.status === 'pending'
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              className="neo-minimal-scope fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            >
              <div className="border-border/80 bg-card flex max-h-[85vh] w-full max-w-md flex-col rounded-lg border shadow-xl">
                <div className="border-border flex items-center justify-between border-b p-4">
                  <div>
                    <h3 className="text-foreground font-bold">{teamName(openOrder)}</h3>
                    <p className="text-muted-foreground text-xs">
                      {t('storeOrders.orderDialogHint')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <NeoButton
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        openOrder.inventory_order_items
                          .filter((item) => !item.fulfilled && !item.completed_at)
                          .forEach((item) =>
                            fulfilItem.mutate(
                              { orderItemId: item.id, fulfilled: true },
                              {
                                onError: (err) =>
                                  notify(errText(err, t('storeOrders.updateItemFailed'))),
                              },
                            ),
                          )
                      }
                    >
                      {t('storeOrders.selectAll')}
                    </NeoButton>
                    <NeoButton variant="ghost" size="sm" onClick={() => setOpenOrderId(null)}>
                      {t('common:close')}
                    </NeoButton>
                  </div>
                </div>
                <ul className="divide-border/60 min-h-0 flex-1 divide-y overflow-y-auto px-4">
                  {openOrder.inventory_order_items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                      <input
                        type="checkbox"
                        className="size-5"
                        checked={item.fulfilled}
                        disabled={Boolean(item.completed_at)}
                        onChange={(e) =>
                          fulfilItem.mutate(
                            { orderItemId: item.id, fulfilled: e.target.checked },
                            {
                              onError: (err) =>
                                notify(errText(err, t('storeOrders.updateItemFailed'))),
                            },
                          )
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${item.completed_at ? 'text-muted-foreground line-through' : ''}`}>
                          {item.quantity}× {item.item_name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {t('storeOrders.pointsEach', { points: item.points_cost_each })}
                          {item.completed_at ? ` · ${t('storeOrders.handedOverPointsTaken')}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="border-border flex gap-2 border-t p-4">
                  <NeoButton
                    variant="surface"
                    size="sm"
                    className="text-destructive"
                    disabled={cancelOrder.isPending || completeOrder.isPending}
                    onClick={() => void cancel(openOrder)}
                  >
                    {t('storeOrders.cancelOrder')}
                  </NeoButton>
                  <NeoButton
                    variant="primary"
                    size="sm"
                    className="ml-auto"
                    disabled={completeOrder.isPending || selectedPoints(openOrder) === 0}
                    onClick={() => void complete(openOrder)}
                  >
                    {completeOrder.isPending
                      ? t('storeOrders.completing')
                      : t('storeOrders.completeSelected', { points: selectedPoints(openOrder) })}
                  </NeoButton>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </Card>
  )
}
