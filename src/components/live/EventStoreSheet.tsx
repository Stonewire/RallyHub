import { Minus, Plus, ShoppingBag, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { useNotification } from '@/contexts/notification-context'
import { getCurrentParticipantSession } from '@/lib/participant-session'
import { supabase } from '@/lib/supabase'

type StoreRow = {
  item_id: string
  name: string
  description: string | null
  image_url: string | null
  points_cost: number
  total_stock: number
  per_team_limit: number
  sold: number
  my_team_qty: number
  team_score: number
}

type OrderRow = {
  order_id: string
  status: 'pending' | 'done' | 'cancelled'
  total_points: number
  created_at: string
  item_name: string
  quantity: number
  fulfilled: boolean
}

type EventStoreSheetProps = {
  eventId: string
  accentColor: string
  onClose: () => void
  /** Fired after a successful order, once the sheet has closed. */
  onOrderPlaced?: () => void
  /** 'store' browses and orders; 'orders' is the read-only My Items view. */
  view?: 'store' | 'orders'
}

function rpcMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}

/**
 * The store as a team sees it: browse what the organiser brought, put items
 * in the basket, send the order. Points are NOT taken here — the facilitator
 * hands the items over and completes the order, and that is when the score
 * moves. Replaces scanning printed QR codes, which mixed up items when many
 * teams scanned at once (7 Aug 2026 event).
 */
export function EventStoreSheet({ eventId, accentColor, onClose, onOrderPlaced, view = 'store' }: EventStoreSheetProps) {
  const { notify } = useNotification()
  const session = getCurrentParticipantSession()
  const token = session?.eventId === eventId ? (session.purchaseToken ?? '') : ''

  const [rows, setRows] = useState<StoreRow[] | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [basket, setBasket] = useState<Record<string, number>>({})
  const [placing, setPlacing] = useState(false)

  const reload = useCallback(async () => {
    if (!token) {
      setLoadError('Join a team on this phone first, then open the store again.')
      return
    }
    const [storeRes, ordersRes] = await Promise.all([
      supabase.rpc('get_event_store', { p_event_id: eventId, p_purchase_token: token }),
      supabase.rpc('get_team_store_orders', { p_event_id: eventId, p_purchase_token: token }),
    ])
    if (storeRes.error) {
      setLoadError(rpcMessage(storeRes.error, 'Could not open the store.'))
      return
    }
    setLoadError(null)
    setRows((storeRes.data ?? []) as StoreRow[])
    if (!ordersRes.error) setOrders((ordersRes.data ?? []) as OrderRow[])
  }, [eventId, token])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern; setState happens after an await, not synchronously
    void reload()
    // Anon players get no realtime on the orders table (org-scoped RLS), so
    // poll while the sheet is open: the WAITING chip flips to Collected and
    // the score drops shortly after the facilitator completes the order.
    const timer = window.setInterval(() => void reload(), 10_000)
    return () => window.clearInterval(timer)
  }, [reload])

  const teamScore = rows?.[0]?.team_score ?? 0
  const basketTotal = useMemo(
    () =>
      Object.entries(basket).reduce((sum, [itemId, qty]) => {
        const row = rows?.find((r) => r.item_id === itemId)
        return sum + (row ? row.points_cost * qty : 0)
      }, 0),
    [basket, rows],
  )
  const basketCount = Object.values(basket).reduce((a, b) => a + b, 0)

  function maxForRow(row: StoreRow): number {
    // The tightest of: stock left for everyone, this team's remaining
    // allowance, and what the team could still afford on top of the rest of
    // the basket.
    const stockLeft = Math.max(0, row.total_stock - row.sold)
    const allowanceLeft = Math.max(0, row.per_team_limit - row.my_team_qty)
    return Math.min(stockLeft, allowanceLeft)
  }

  function adjust(row: StoreRow, delta: number) {
    setBasket((current) => {
      const qty = Math.max(0, Math.min((current[row.item_id] ?? 0) + delta, maxForRow(row)))
      const next = { ...current }
      if (qty === 0) delete next[row.item_id]
      else next[row.item_id] = qty
      return next
    })
  }

  async function placeOrder() {
    if (basketCount === 0 || placing) return
    setPlacing(true)
    try {
      const items = Object.entries(basket).map(([itemId, quantity]) => ({ itemId, quantity }))
      const { error } = await supabase.rpc('place_store_order', {
        p_event_id: eventId,
        p_purchase_token: token,
        p_items: items,
      })
      if (error) throw error
      setBasket({})
      // The job here is done; the next stop is a person, not this screen.
      onClose()
      onOrderPlaced?.()
      return
    } catch (err) {
      notify(rpcMessage(err, 'Could not send your order. Try again.'))
      // Stock may have moved under us; show the fresh numbers.
      void reload()
    } finally {
      setPlacing(false)
    }
  }

  const pendingOrders = orders.filter((o) => o.status === 'pending')
  const doneOrders = orders.filter((o) => o.status === 'done')

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="experience-scope fixed inset-0 z-[10000] flex flex-col bg-black/90 text-white">
      <div
        className="flex shrink-0 items-center justify-between px-4 pb-2"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2">
          <ShoppingBag className="size-5" />
          <h2 className="text-lg font-bold">{view === 'orders' ? 'My Items' : 'Store'}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold tabular-nums">
            {teamScore - basketTotal} pts
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close store"
            className="flex size-11 items-center justify-center rounded-full bg-white/15"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-40">
        {loadError ? (
          <p className="mx-auto mt-8 max-w-md text-center text-sm text-white/80">{loadError}</p>
        ) : rows === null ? (
          <p className="mx-auto mt-8 text-center text-sm text-white/70">Opening the store…</p>
        ) : view === 'orders' ? null : rows.length === 0 ? (
          <p className="mx-auto mt-8 max-w-md text-center text-sm text-white/80">
            The store is empty for this event.
          </p>
        ) : (
          <ul className="mx-auto mt-3 max-w-md space-y-3">
            {rows.map((row) => {
              const inBasket = basket[row.item_id] ?? 0
              const left = Math.max(0, row.total_stock - row.sold)
              const cap = maxForRow(row)
              const affordMore = teamScore - basketTotal >= row.points_cost
              return (
                <li key={row.item_id} className="xp-glass-panel rounded-xl bg-white/10 p-3">
                  <div className="flex items-center gap-3">
                    {row.image_url ? (
                      <img src={row.image_url} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-white/10">
                        <ShoppingBag className="size-6 text-white/60" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="xp-wrap-text font-bold">{row.name}</p>
                      <p className="text-sm text-white/80">{row.points_cost} pts</p>
                      <p className="text-xs text-white/60">
                        {left === 0
                          ? 'Sold out'
                          : `${left} left · max ${row.per_team_limit} per team`}
                        {row.my_team_qty > 0 ? ` · you have ${row.my_team_qty}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Fewer ${row.name}`}
                        disabled={inBasket === 0}
                        onClick={() => adjust(row, -1)}
                        className="flex size-9 items-center justify-center rounded-full bg-white/15 disabled:opacity-40"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="w-5 text-center font-bold tabular-nums">{inBasket}</span>
                      <button
                        type="button"
                        aria-label={`More ${row.name}`}
                        disabled={inBasket >= cap || !affordMore}
                        onClick={() => adjust(row, 1)}
                        className="flex size-9 items-center justify-center rounded-full bg-white/15 disabled:opacity-40"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  </div>
                  {row.description ? (
                    <p className="mt-2 text-xs whitespace-pre-wrap text-white/70">{row.description}</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}

        {view === 'orders' && rows !== null && pendingOrders.length === 0 && doneOrders.length === 0 ? (
          <p className="mx-auto mt-8 max-w-md text-center text-sm text-white/80">
            Nothing bought yet. Order from the Store first.
          </p>
        ) : null}

        {pendingOrders.length > 0 || doneOrders.length > 0 ? (
          <div className="mx-auto mt-6 max-w-md space-y-2">
            <h3 className="text-sm font-bold tracking-wide text-white/70 uppercase">
              Your orders
            </h3>
            {[...pendingOrders, ...doneOrders]
              .reduce<{ id: string; status: string; items: OrderRow[] }[]>((groups, row) => {
                const group = groups.find((g) => g.id === row.order_id)
                if (group) group.items.push(row)
                else groups.push({ id: row.order_id, status: row.status, items: [row] })
                return groups
              }, [])
              .map((group) => (
                <div key={group.id} className="xp-glass-panel rounded-xl bg-white/10 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">
                      {group.items.map((i) => `${i.quantity}× ${i.item_name}`).join(', ')}
                    </p>
                    <span
                      className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        group.status === 'done'
                          ? 'bg-emerald-500 text-black'
                          : 'bg-amber-400 text-black'
                      }`}
                    >
                      {group.status === 'done' ? 'Collected' : 'Waiting'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/60">
                    {group.items[0]?.total_points ?? 0} pts
                    {group.status === 'pending' ? ' · collect from the facilitator' : ''}
                  </p>
                </div>
              ))}
          </div>
        ) : null}
      </div>

      {view === 'orders' ? null : (
      <div
        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/90 to-transparent px-4 pt-6"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <LiveAccentButton
          type="button"
          className="mx-auto min-h-12 w-full max-w-md text-base"
          accentColor={accentColor}
          disabled={basketCount === 0 || placing}
          onClick={() => void placeOrder()}
        >
          {placing
            ? 'Sending order…'
            : basketCount === 0
              ? 'Pick some items'
              : `Order ${basketCount} item${basketCount === 1 ? '' : 's'} · ${basketTotal} pts`}
        </LiveAccentButton>
      </div>
      )}
    </div>,
    document.body,
  )
}
