# Payments, plan capacity, and unit economics

Last reviewed: 16 July 2026

This document is the current payment reference. All prices exclude VAT. Custom
plans are negotiated directly and Partner accounts are fully comped, so neither
is modelled as a standard self-serve plan.

## Final pricing

| Plan | Monthly subscription | Yearly subscription | Per event | Events/month | Included teams/event |
|---|---:|---:|---:|---:|---:|
| Pay Per Event | None | None | €199 | Unlimited | 5 |
| Starter | €20 | €180 | €149 | 2 | 5 |
| Pro | €200 | €1,800 | €99 | Unlimited | 5 |
| Custom | Contact us | Contact us | Custom | Custom | Custom |

- Additional teams are available as a per-event purchase on Pay Per Event,
  Starter, and Pro. The add-on price and Paddle product still need to be decided;
  until then, the activation gate enforces the included five teams.
- Pro can remove RallyHub branding per event for an additional cost. That add-on
  price and Paddle product also still need to be decided.
- Business is retired. There are no active customers to grandfather.
- There is no automatic signup trial and no automatic free first event. Selected
  clients can receive a complimentary event through a 100% event promo code.

## Payment and activation rules

- Starter and Pro require an active, paid-through subscription before an event
  can be activated.
- Pay Per Event has no subscription. Its event activates immediately and is
  invoiced afterward. Another event is blocked while an earlier invoice remains
  unpaid.
- The event activates before its per-event charge runs in the background, so a
  payment delay or failure does not interrupt a live event.
- Monthly event and included-team limits are enforced by the database activation
  trigger, not only by the website.
- Only the organisation's client admin or a RallyHub super admin may open Paddle
  checkout or manage billing.

## Effective customer price per event

Pay Per Event always costs €199 per event before VAT.

Starter can run at most 24 events per year. At full use:

| Billing choice | Annual subscription | Annual event charges | Annual total | Effective price/event |
|---|---:|---:|---:|---:|
| Monthly | €240 | €3,576 | €3,816 | €159.00 |
| Yearly | €180 | €3,576 | €3,756 | €156.50 |

Pro has no event cap, so its effective price falls as the subscription is spread
over more events:

| Events/month | Events/year | Effective price/event, monthly subscription | Effective price/event, yearly subscription |
|---:|---:|---:|---:|
| 1 | 12 | €299.00 | €249.00 |
| 2 | 24 | €199.00 | €174.00 |
| 5 | 60 | €139.00 | €129.00 |
| 10 | 120 | €119.00 | €114.00 |
| 20 | 240 | €109.00 | €106.50 |

Starter is the strongest fit for one or two events per month. Pro is the
unlimited-volume option and becomes progressively more attractive as usage grows.

## Paddle fees

Paddle's public pay-as-you-go fee is 5% + €0.50 per checkout transaction. The
figures below assume every event is a separate checkout and either 12 monthly
subscription charges or one yearly subscription charge. Actual fees can vary
with tax and any negotiated Paddle rate.

- A €199 Pay Per Event charge costs approximately €10.45 in Paddle fees, leaving
  €188.55 before infrastructure and support.
- A €149 Starter event charge costs approximately €7.95. At the full 24 events,
  total annual Paddle fees are about €208.80 with monthly subscription billing or
  €200.30 with yearly billing.
- A €99 Pro event charge costs approximately €5.45. The subscription itself adds
  about €126/year in Paddle fees when paid monthly or €90.50 when paid yearly.

## Hosting hard costs

Current planning assumptions:

- Supabase Pro: $25/month base, with storage, egress, Realtime and Edge Function
  usage included up to the plan allowances.
- Vercel Pro: $20/month base with included usage credit.
- Resend: €0 while usage remains inside the free quota; a paid email plan becomes
  another shared monthly cost when required.
- Media-heavy events can add storage and egress cost above the included quotas.
- The Storage-first lifecycle in `docs/DATA-LIFECYCLE.md` removes event media at
  Bin expiry, six-month retention, permanent event deletion, and client deletion.

Using the existing planning conversion (€1 = $1.1405), shared Supabase + Vercel
base cost is approximately €39.46/month:

| Total RallyHub events/month | Shared base allocated per event |
|---:|---:|
| 10 | €3.95 |
| 50 | €0.79 |
| 100 | €0.39 |
| 500 | €0.08 |

At 100 total platform events/month, and allowing €0.10–€1.00 per event for media
above included quotas, approximate direct hard cost is:

| Plan/usage | Approximate direct hard cost/event |
|---|---:|
| Pay Per Event | €10.94–€11.84 |
| Starter at 2 events/month | €8.84–€10.09 |
| Pro at 5–20 events/month | €6.32–€9.04 |

These estimates exclude staffing and general support time. Quiz and bingo-only
events should sit near the low end; video-heavy events can be higher.

## Live-payment launch

The step-by-step production cutover is maintained in
`docs/PADDLE-LIVE-CHECKLIST.md`.

- Paddle sandbox subscription, event payment, webhook, and auto-charge paths were
  confirmed tested by Rumen on 15 July 2026.
- Apply the final-pricing and pending billing/lifecycle migrations.
- Deploy the current Paddle Edge Functions and `data-lifecycle`.
- Configure production Paddle and lifecycle secrets in Supabase and Vercel.
- Confirm VAT-exclusive tax treatment and the production webhook events.
- Leave both plan-change flags off until the production smoke test succeeds, then
  enable them together.
