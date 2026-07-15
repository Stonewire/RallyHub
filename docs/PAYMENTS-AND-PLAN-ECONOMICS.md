# Payments, plan capacity, and unit economics

Last reviewed: 15 July 2026

This document is the current payment reference. Prices exclude VAT. Enterprise
is negotiated directly and Partner is fully comped, so neither can be modelled
as a standard self-serve plan.

## Current rules

- Event discounts are explicit. There is no automatic free first event.
- A selected client can still receive a complimentary event through a 100%
  event promo code.
- Starter, Pro, and Business require an active paid-through subscription before
  an event can be activated.
- The event activates first; its per-event invoice is then charged in the
  background. A failed charge never interrupts a live event.
- Free has no subscription. Its first event activates immediately and is
  invoiced afterward, but another event is blocked while an earlier invoice is
  unpaid.
- Plan event and team limits are enforced by the database activation trigger.
- Only the organisation's client admin or a RallyHub super admin may open
  Paddle checkout or manage billing.

## Approved working pricing

This is the working ladder approved for implementation on 15 July 2026. It can
still be revisited after partner review. Plan changes remain feature-flagged off
until the production billing deployment is approved.

| Plan | Monthly subscription | Yearly subscription | Per event | Events/month | Events/year at maximum | Teams/event |
|---|---:|---:|---:|---:|---:|---:|
| Free | €0 | €0 | €199 | 1 | 12 | 10 |
| Starter | €20 | €180 | €149 | 10 | 120 | 20 |
| Pro | €70 | €660 | €99 | 20 | 240 | 30 |
| Business | €150 | €1,440 | €95 | 40 | 480 | 50 |

## Full-capacity customer cost

This spreads the subscription across every event when the customer uses the
maximum allowance for all 12 months.

| Plan | Annual event charges | Annual total when subscription is paid monthly | Effective customer price/event | Annual total when subscription is paid yearly | Effective customer price/event |
|---|---:|---:|---:|---:|---:|
| Free | €2,388 | €2,388 | €199.00 | €2,388 | €199.00 |
| Starter | €17,880 | €18,120 | €151.00 | €18,060 | €150.50 |
| Pro | €23,760 | €24,600 | €102.50 | €24,420 | €101.75 |
| Business | €45,600 | €47,400 | €98.75 | €47,040 | €98.00 |

## Paddle cost at full capacity

Paddle's public pay-as-you-go fee is 5% + €0.50 per checkout transaction. The
model below applies that fee to every event charge and to either 12 monthly
subscription charges or one yearly subscription charge. Actual fees can vary
with the taxable checkout total and any negotiated Paddle pricing.

| Plan | Paddle cost/event charge | Annual Paddle fees with monthly subscription | Net annual receipts after Paddle | Annual Paddle fees with yearly subscription | Net annual receipts after Paddle |
|---|---:|---:|---:|---:|---:|
| Free | €10.45 | €125.40 | €2,262.60 | €125.40 | €2,262.60 |
| Starter | €7.95 | €972.00 | €17,148.00 | €963.50 | €17,096.50 |
| Pro | €5.45 | €1,356.00 | €23,244.00 | €1,341.50 | €23,078.50 |
| Business | €5.25 | €2,616.00 | €44,784.00 | €2,592.50 | €44,447.50 |

## Hosting hard costs

Current public vendor pricing and the ECB reference rate used for this model:

- Supabase Pro: $25/month, including 100 GB file storage, 250 GB egress,
  5 million Realtime messages, and 2 million Edge Function invocations.
  Overage includes $0.0213/GB-month storage, $0.09/GB uncached egress,
  $0.03/GB cached egress, $2.50/million Realtime messages, and $2/million Edge
  Function calls. Source: https://supabase.com/pricing
- Vercel Pro: $20/month with $20 included usage credit, 1 TB data transfer, and
  10 million edge requests. Source: https://vercel.com/pricing
- Paddle: 5% + €0.50 per checkout transaction, with tax/compliance and billing
  support included. Source: https://www.paddle.com/pricing
- Resend: $0 up to 3,000 transactional emails/month; Pro is $20/month for
  50,000. Source: https://resend.com/pricing
- ECB reference rate on 14 July 2026: €1 = $1.1405. Source:
  https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html

At that exchange rate, the shared Supabase + Vercel base is approximately
€39.46/month. It is not an event-specific cost. Its allocation is:

| Total RallyHub events/month | Shared base allocated per event |
|---:|---:|
| 10 | €3.95 |
| 50 | €0.79 |
| 100 | €0.39 |
| 500 | €0.08 |

Resend currently adds €0 while usage remains within its free quota. If Pro is
needed, add approximately €17.54/month to the shared base.

### Approximate direct hard cost per event

Formula:

`Paddle event fee + allocated subscription transaction fee + shared monthly infrastructure / platform events + storage and egress`

At 100 total platform events/month, with a typical media allowance of €0.10–€1
per event above included quotas:

| Plan | Approximate direct hard cost/event |
|---|---:|
| Free | €10.94–€11.84 |
| Starter | €8.59–€9.49 |
| Pro | €6.04–€6.94 |
| Business | €5.89–€6.79 |

Quiz and bingo-only events should be near the bottom because their database,
Realtime, and Function usage is tiny relative to included quotas. Video-heavy
events may add roughly €1–€5 in storage/egress at overage rates, depending on
file size, repeat viewing, and retention.

Storage risk is addressed by the Storage-first lifecycle in
`docs/DATA-LIFECYCLE.md`: event Bin expiry, six-month retention, manual permanent
event deletion, and complete client deletion all use the same retryable worker.

## Commercial shape of the approved ladder

- One monthly event costs €169 on Starter and €169 on Pro.
- From the second event onward, Pro is the attractive standard deal.
- Monthly Pro and Business both total €2,050 at 20 events. Business becomes the
  required capacity tier above Pro's 20-event or 30-team limits.
- Business gets a modest further event discount (€95 rather than €99) without
  making Pro irrational from the first event.
- With annual subscriptions, Business becomes cheaper at roughly 17 events per
  month because its recurring fee is discounted more heavily across the year.

## Live-payment launch checklist

The step-by-step production cutover is maintained in
`docs/PADDLE-LIVE-CHECKLIST.md`.

- Paddle sandbox subscription, event payment, webhook, and auto-charge paths:
  confirmed tested by Rumen on 15 July 2026.
- Apply the no-automatic-free-event migration.
- Deploy the current `paddle-checkout` and `paddle-webhook` functions.
- Deploy `data-lifecycle`, configure its cron secret and the two Vault values in
  `docs/DATA-LIFECYCLE.md`, then run the deletion verification checklist.
- Set `PADDLE_ENVIRONMENT=production`, the live Paddle API key, and the live
  webhook signing secret in Supabase.
- Set the live Paddle client token and `VITE_PADDLE_ENVIRONMENT=production` in
  Vercel.
- Confirm Paddle tax settings are VAT-exclusive.
- Confirm the production webhook destination subscribes to transaction and all
  subscription lifecycle events handled by `paddle-webhook`.
- Leave `VITE_ENABLE_PLAN_CHANGES=false` and `ENABLE_PLAN_CHANGES=false` until
  pricing is approved. Enable both together afterward.
