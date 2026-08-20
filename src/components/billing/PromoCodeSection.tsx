import type { TFunction } from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { QueryError } from '@/components/admin/QueryState'
import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useNotification } from '@/contexts/notification-context'
import {
  useOrgPromoRedemptions,
  useRedeemPromoCode,
  type PromoRedemption,
} from '@/hooks/use-promo-codes'

function redemptionLabel(r: PromoRedemption, t: TFunction<'admin'>): string {
  if (r.purpose === 'subscription') {
    return r.duration_months
      ? t('billing.promoSubscriptionOffDuration', {
          percent: r.discount_percent,
          count: r.duration_months,
        })
      : t('billing.promoSubscriptionOff', { percent: r.discount_percent })
  }
  return r.discount_percent >= 100
    ? t('billing.promoFreeEvent')
    : t('billing.promoEventOff', { percent: r.discount_percent })
}

type PromoCodeSectionProps = {
  organizationId: string | null | undefined
  /** Show the redeem form. Only the org's own billing panel can add codes. */
  allowAdd?: boolean
}

export function PromoCodeSection({ organizationId, allowAdd = false }: PromoCodeSectionProps) {
  const { t } = useTranslation('admin')
  const { notify } = useNotification()
  const redemptionsQuery = useOrgPromoRedemptions(organizationId)
  const redeem = useRedeemPromoCode(organizationId)
  const [code, setCode] = useState('')

  async function handleAdd() {
    const trimmed = code.trim()
    if (!trimmed) return
    try {
      const r = await redeem.mutateAsync(trimmed)
      notify(t('billing.promoCodeAdded', { detail: redemptionLabel(r, t) }))
      setCode('')
    } catch (err) {
      notify(err instanceof Error ? err.message : t('billing.couldNotAddPromoCode'))
    }
  }

  const redemptions = redemptionsQuery.data ?? []
  const active = redemptions.filter((r) => r.status === 'active')
  const used = redemptions.filter((r) => r.status !== 'active')

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-foreground text-lg font-semibold">{t('billing.promoCodes')}</h2>
        <p className="text-muted-foreground text-sm">{t('billing.promoCodesHint')}</p>
      </div>

      <Card className="border-border/80 space-y-4 bg-card p-5 shadow-sm">
        {allowAdd ? (
          <div className="flex flex-wrap items-end gap-2" data-tour="promo-code-input">
            <div className="min-w-[12rem] flex-1 space-y-1">
              <label htmlFor="promo-code-input" className="text-sm font-medium">
                {t('billing.addPromoCode')}
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
            <NeoButton
              type="button"
              variant="accent"
              disabled={redeem.isPending || !code.trim()}
              onClick={() => void handleAdd()}
            >
              {redeem.isPending ? t('billing.adding') : t('billing.addCode')}
            </NeoButton>
          </div>
        ) : null}

        {redemptionsQuery.isError ? (
          <QueryError message={redemptionsQuery.error.message} />
        ) : null}

        {active.length > 0 ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              {t('billing.promoActive')}
            </p>
            <ul className="space-y-2">
              {active.map((r) => (
                <li
                  key={r.id}
                  className="border-border/70 flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                >
                  <span className="text-foreground font-medium">{redemptionLabel(r, t)}</span>
                  <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-xs capitalize">
                    {t(`billing.promoPurpose.${r.purpose}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t('billing.noActivePromoCodes')}</p>
        )}

        {used.length > 0 ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              {t('billing.promoApplied')}
            </p>
            <ul className="space-y-1">
              {used.map((r) => (
                <li key={r.id} className="text-muted-foreground text-sm">
                  {redemptionLabel(r, t)} · {t('billing.promoAppliedSuffix')}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </section>
  )
}
