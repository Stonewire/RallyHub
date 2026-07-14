import { ArrowRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'

import { NeoCard } from '@/components/neo-minimal'
import {
  formatBrandingNote,
  formatEventLimit,
  formatPerEventPrice,
  formatTeamLimit,
  getVisiblePlans,
  planPriceDisplay,
  VAT_DISCLAIMER,
  type SubscriptionPlan,
} from '@/lib/subscription-plans'

import { Reveal } from './Reveal'

function planCta(plan: SubscriptionPlan): { label: string; to: string } {
  if (plan.priceOnRequest) return { label: 'Contact sales', to: '/contact' }
  if (plan.freeSubscription) return { label: 'Get started', to: `/register?plan=${plan.id}` }
  return { label: `Choose ${plan.name}`, to: `/register?plan=${plan.id}` }
}

function planFeatures(plan: SubscriptionPlan): string[] {
  const lines = [formatPerEventPrice(plan), formatEventLimit(plan), formatTeamLimit(plan)]
  const branding = formatBrandingNote(plan)
  if (branding) lines.push(branding)
  return lines
}

export function PricingSection() {
  const plans = getVisiblePlans()

  return (
    <section id="pricing" className="py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-12">
        <Reveal className="max-w-2xl">
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.05em]">
            Simple, per-event pricing
          </p>
          <h2 className="text-foreground font-display mt-3 text-3xl font-normal leading-[1.12] tracking-tight sm:text-4xl">
            Pick a plan.{' '}
            <span className="text-muted-foreground">Pay per event on top.</span>
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, i) => {
            const price = planPriceDisplay(plan)
            const cta = planCta(plan)
            return (
              <Reveal key={plan.id} delay={i % 3}>
                <NeoCard className="flex h-full flex-col gap-4 p-8">
                  <h3 className="text-foreground text-2xl font-bold">{plan.name}</h3>
                  <div>
                    <p className="text-foreground text-3xl font-bold tabular-nums">
                      {price.headline}
                    </p>
                    {price.yearlyNote ? (
                      <p className="text-muted-foreground mt-1 text-sm">{price.yearlyNote}</p>
                    ) : null}
                    {price.monthlyNote ? (
                      <p className="text-muted-foreground text-sm">{price.monthlyNote}</p>
                    ) : null}
                  </div>
                  <ul className="text-muted-foreground flex-1 space-y-2 text-sm">
                    {planFeatures(plan).map((line) => (
                      <li key={line} className="flex items-start gap-2">
                        <Check className="text-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                        {line}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={cta.to}
                    className="text-foreground hover:text-foreground/80 inline-flex items-center gap-1.5 text-sm font-semibold"
                  >
                    {cta.label}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </NeoCard>
              </Reveal>
            )
          })}
        </div>

        <p className="text-muted-foreground mt-6 text-xs">{VAT_DISCLAIMER}</p>
      </div>
    </section>
  )
}
