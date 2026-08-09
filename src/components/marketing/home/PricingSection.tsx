import { Link } from 'react-router-dom'

import {
  getVisiblePlans,
  planFeatures,
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

export function PricingSection() {
  const plans = getVisiblePlans()

  return (
    <section id="pricing" className="scroll-mt-20">
      <div className="mk-wrap mk-section">
        <Reveal style={{ maxWidth: '44rem' }}>
          <h2 className="mk-h2">Pick a plan. Pay per event on top.</h2>
          <p className="mk-lead mk-muted" style={{ marginTop: '1.1rem' }}>
            Every plan includes every game type, the facilitator control room, the big-screen
            display and per-event branding.
          </p>
        </Reveal>

        <div className="mk-price-grid">
          {plans.map((plan, i) => {
            const price = planPriceDisplay(plan)
            const cta = planCta(plan)
            const hot = plan.id === 'pro'
            return (
              <Reveal key={plan.id} delay={i % 3} className={hot ? 'mk-price mk-price--hot' : 'mk-price'}>
                <div className="flex items-center justify-between gap-2">
                  <h3>{plan.name}</h3>
                  {hot ? <span className="mk-chip mk-chip--yellow">Best rate</span> : null}
                </div>
                <div>
                  <p className="mk-price-amount">{price.headline}</p>
                  {price.yearlyNote ? <p className="mk-price-note">{price.yearlyNote}</p> : null}
                  {price.monthlyNote ? <p className="mk-price-note">{price.monthlyNote}</p> : null}
                </div>
                <ul>
                  {planFeatures(plan).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <Link to={cta.to} className="mk-link">
                  {cta.label}
                </Link>
              </Reveal>
            )
          })}
        </div>

        <p className="mk-price-note" style={{ marginTop: '1.4rem' }}>
          {VAT_DISCLAIMER}
        </p>
      </div>
    </section>
  )
}
