import { useState } from 'react'

import { QueryError } from '@/components/admin/QueryState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useNotification } from '@/contexts/notification-context'
import {
  useOrgPromoRedemptions,
  useRedeemPromoCode,
  type PromoRedemption,
} from '@/hooks/use-promo-codes'

function redemptionLabel(r: PromoRedemption): string {
  const base =
    r.purpose === 'subscription'
      ? `${r.discount_percent}% off subscription${
          r.duration_months ? ` for ${r.duration_months} month${r.duration_months === 1 ? '' : 's'}` : ''
        }`
      : r.discount_percent >= 100
        ? 'Free event'
        : `${r.discount_percent}% off your next event`
  return base
}

type PromoCodeSectionProps = {
  organizationId: string | null | undefined
  /** Show the redeem form. Only the org's own billing panel can add codes. */
  allowAdd?: boolean
}

export function PromoCodeSection({ organizationId, allowAdd = false }: PromoCodeSectionProps) {
  const { notify } = useNotification()
  const redemptionsQuery = useOrgPromoRedemptions(organizationId)
  const redeem = useRedeemPromoCode(organizationId)
  const [code, setCode] = useState('')

  async function handleAdd() {
    const trimmed = code.trim()
    if (!trimmed) return
    try {
      const r = await redeem.mutateAsync(trimmed)
      notify(`Promo code added — ${redemptionLabel(r)}`)
      setCode('')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not add promo code')
    }
  }

  const redemptions = redemptionsQuery.data ?? []
  const active = redemptions.filter((r) => r.status === 'active')
  const used = redemptions.filter((r) => r.status !== 'active')

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-foreground text-lg font-semibold">Promo codes</h2>
        <p className="text-muted-foreground text-sm">
          Active codes apply automatically — event codes on your next event activation,
          subscription codes on recurring billing.
        </p>
      </div>

      <Card className="border-border/80 space-y-4 bg-card p-5 shadow-sm">
        {allowAdd ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1 space-y-1">
              <label htmlFor="promo-code-input" className="text-sm font-medium">
                Add a promo code
              </label>
              <Input
                id="promo-code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SUMMER25"
                className="bg-background font-mono"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleAdd()
                }}
              />
            </div>
            <Button
              type="button"
              disabled={redeem.isPending || !code.trim()}
              onClick={() => void handleAdd()}
            >
              {redeem.isPending ? 'Adding…' : 'Add code'}
            </Button>
          </div>
        ) : null}

        {redemptionsQuery.isError ? (
          <QueryError message={redemptionsQuery.error.message} />
        ) : null}

        {active.length > 0 ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Active
            </p>
            <ul className="space-y-2">
              {active.map((r) => (
                <li
                  key={r.id}
                  className="border-border/70 flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                >
                  <span className="text-foreground font-medium">{redemptionLabel(r)}</span>
                  <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-xs capitalize">
                    {r.purpose}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No active promo codes.</p>
        )}

        {used.length > 0 ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Applied
            </p>
            <ul className="space-y-1">
              {used.map((r) => (
                <li key={r.id} className="text-muted-foreground text-sm">
                  {redemptionLabel(r)} · applied
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </section>
  )
}
