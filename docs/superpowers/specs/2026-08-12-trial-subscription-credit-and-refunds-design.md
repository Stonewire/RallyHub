# Trial, cancellation, credit and refund model. Design

Date: 2026-08-12

## Goal

Give self-serve clients a 30-day trial of a paid plan (Starter or Pro), a fair
cancellation path, an account credit balance, and a plain 30-day refund policy.
The model must be non-predatory: no hidden fees, cancel anytime, and customers
never silently lose value they paid for. It must also fix the current defect
where a completed subscription never shows as active in the billing screen.

## Context and current state

Prices and plan behaviour live in `src/lib/subscription-plans.ts`. Internal plan
ids stay for database compatibility; customer-facing names differ:

| Internal id | Name | Monthly | Yearly | Per event | Events/month | Teams |
|---|---|---:|---:|---:|---:|---:|
| `rookie` | Pay Per Event | none | none | €199 | unlimited | 5 |
| `arena` | Starter | €20 | €180 | €149 | 2 | 5 |
| `pro` | Pro | €200 | €1,800 | €99 | unlimited | 5 |
| `enterprise` | Custom | contact | contact | custom | custom | custom |
| `partner` | Partner | comped | comped | comped | unlimited | unlimited |

All prices exclude VAT; Paddle adds tax as Merchant of Record. Additional teams
cost €10 each (`ADDITIONAL_TEAM_PRICE_EUR`).

Relevant existing pieces:

- `organizations` billing columns: `billing_plan`, `billing_period`,
  `subscription_status`, `paddle_subscription_id`, `paddle_customer_id`,
  `subscription_current_period_end`, plus `account_status`.
- The activation gate is a Postgres function (`assert_event_activation_allowed`)
  that raises tagged errors (`SUBSCRIPTION_REQUIRED`, `UNPAID_INVOICE`,
  `EVENT_LIMIT_REACHED`, `TEAM_LIMIT_EXCEEDED`, `ORG_SUSPENDED`). Starter and Pro
  require an active, paid-through subscription before an event activates. Pay Per
  Event activates immediately and is invoiced afterward.
- Per-event and additional-team pricing is computed server-side from
  `billing_plan`, never from browser-supplied values
  (`src/lib/event-activation-billing.ts`, `additional-team-billing.ts`).
- The `paddle-webhook` Edge Function already syncs subscription status and
  already treats `trialing` and `active` as keeping the org active. It handles
  `subscription.created/updated/activated/canceled/paused/past_due/resumed` and
  `transaction.completed/payment_failed`.
- Tables that already exist: `invoices` (per-event), `subscription_transactions`,
  `promo_code_redemptions`.

Prerequisite (tracked separately as PAY-3, not part of this build): the live
`PADDLE_WEBHOOK_SECRET` must match the live notification destination, or none of
the statuses below ever land. Every trial and subscription status in this design
depends on webhooks being accepted (currently rejected 401).

## The trial

Approach: use Paddle's native subscription trial rather than tracking a trial
ourselves. Paddle defers the first charge, auto-charges on day 30, and runs the
retry/dunning if that charge fails. Our own logic stays thin. A custom trial
would reinvent all of that with more failure modes, so it is rejected.

Rules:

- A new account starts on Pay Per Event.
- From there it may start a 30-day trial of Starter or Pro, in monthly or yearly
  billing, once per account, ever.
- Starting a trial requires a saved card (so the day-30 charge can run). Nothing
  is charged to start.
- During the trial the org's `billing_plan` is set to the trialed plan and
  `subscription_status` is `trialing`. The subscription fee is €0 for 30 days,
  but the plan's per-event price and its rules apply in full: Starter charges
  €149 per event with its 2-per-month cap; Pro charges €99 per event, unlimited.
  Per-event charges during the trial are real charges.
- Once used, the trial cannot be started again even after cancellation. Enforced
  by a persistent flag, not by current status.

## Day 30 and beyond

- Not cancelled: Paddle auto-charges the first subscription payment and the paid
  term begins that day. Yearly gives 12 paid months starting on day 30, so 13
  months of access counting the free trial month. Monthly bills each month from
  day 30.
- Charge fails: Paddle sets `past_due` and retries. While `past_due` the org
  falls back to Pay Per Event pricing and rules (the activation gate treats it as
  not paid-through) until the charge clears or the card is fixed.

## Cancellation

Cancel anytime, no fee, no hidden charges. Behaviour depends on when:

- During the trial: nothing is charged, the org drops to Pay Per Event
  immediately. Events already run during the trial stay charged at the trial
  plan's per-event rate (service delivered). The trial is marked used.
- A paid subscription, within 30 days of the first subscription charge: covered
  by the refund policy below (full cash refund available).
- A paid subscription, after the 30-day refund window: the client chooses at the
  cancel screen between two options:
  1. Keep the plan until the end of the period already paid for, then drop to Pay
     Per Event. No credit (they use the full period).
  2. Stop now: the org drops to Pay Per Event immediately, and the unused
     whole-month value of the prepaid subscription converts to account credit.
     Unused whole months only. Example: yearly Pro at €1,800, cancelled after 6
     full months, gives €900 credit.

## Credit

A single account credit balance per organisation, in minor units (cents), never
negative.

Sources of credit:

- A "stop now" cancellation (unused whole-month subscription value).
- An event-not-yet-run refund the client elects to take as credit rather than
  cash (see Refunds).
- Manual goodwill credit issued by a RallyHub super admin.

Spending:

- Credit can offset any RallyHub charge: per-event fees, additional-team fees,
  and future subscription charges.
- Credit never expires.
- Credit is applied automatically to the next charge, reducing the amount Paddle
  charges. Per-event checkouts are created for the net amount after credit; a
  subscription renewal has credit applied via a Paddle transaction adjustment or
  one-time reduction (exact Paddle mechanism finalised in the plan). VAT is
  computed by Paddle on the reduced net amount, since all listed prices are
  VAT-exclusive.
- Every credit change is written to an auditable ledger with a reason and a link
  to the cancellation, refund, or charge that caused it.

## Refunds

- Full cash refund of the first subscription payment if requested within 30 days
  of that charge.
- Per-event charges are refundable only for events not yet run. An event already
  delivered is non-refundable. An eligible per-event refund may be taken as cash
  or as account credit, the client's choice.
- Refunds are requested in-app from the billing screen and executed through
  Paddle. RallyHub records the request and the outcome.
- This policy is voluntary and more generous than EU business-to-business law
  requires (see Legal), stated plainly on a public policy page.

## Data model changes

`organizations`:

- Add `trial_used_at timestamptz null`. Non-null means the one-per-account trial
  has been consumed. Set when a trial starts.
- Add `credit_balance_cents integer not null default 0`. The current spendable
  balance.

New table `account_credit_ledger`:

- `id`, `organization_id`, `delta_cents` (positive for credit issued, negative
  for credit spent), `reason` (enum: `cancellation`, `event_refund`,
  `manual_goodwill`, `applied_to_charge`), `balance_after_cents`, a nullable
  reference to the related invoice or subscription transaction, `created_at`, and
  the actor (super admin id or `system`).

Status values already produced by Paddle and written by the webhook are reused:
`trialing`, `active`, `past_due`, `paused`, `canceled`. No new status enum.

## Activation gate changes

The Postgres activation gate must:

- Treat `trialing` as a valid paid-through state for Starter and Pro, so trial
  events activate. The per-event bill still applies at the plan rate.
- Continue to block on `past_due`, `canceled`, and a missing subscription for the
  paid plans, falling back to Pay Per Event only where that is the org's actual
  plan.
- Apply available credit to the computed per-event bill before charging, and
  record the credit spend in the ledger within the same transaction that creates
  the invoice, so a credit can never be double-spent across two concurrent
  activations.

## Paddle integration

- Start trial: create a Paddle subscription for the chosen plan and period with a
  30-day trial, carrying `custom_data` with `organization_id`, `plan_key`, and
  `billing_period` (the webhook already reads these). Card collected, €0 charged.
- Per-event charge during trial or on any plan: unchanged flow through
  `paddle-checkout`, priced server-side from `billing_plan`, minus any applied
  credit.
- Cancellation: call Paddle to cancel at period end (option 1) or immediately
  (option 2). For option 2, compute unused whole-month value locally and write it
  to the credit ledger; do not rely on a Paddle proration refund.
- Refund: issue through Paddle's refund/adjustment API for the eligible amount,
  then reconcile via the resulting webhook.

## UI

Billing screen (`Settings → Billing`) shows the true state and the right action:

- No subscription and no trial used: plan cards with a "Start 30-day trial"
  action on Starter and Pro, and the current Pay Per Event state.
- Trialing: "Free trial of Pro, ends 12 September", a Cancel button, and a clear
  line that per-event charges still apply during the trial.
- Active: "Pro, started 12 September, renews 12 September 2027", a Cancel button,
  and a Request refund link while inside the 30-day window.
- Past due: a clear "Payment failed, update your card" state, with Pay Per Event
  pricing noted as the fallback until it clears.
- Cancelled but still within a paid period: "Cancelled, access until 12
  September".
- Credit balance shown whenever non-zero, with a short ledger of recent entries.

The cancel flow presents the two after-window options (keep till period end, or
stop now for credit) with the exact credit amount shown before confirming. The
stuck "Start subscription" button is fixed by driving all of the above from the
real status and dates rather than assuming no subscription.

A public refund and cancellation policy page, linked from the footer and the
billing screen, states: the 30-day trial, per-event charges during trial, the
30-day money-back on the first subscription charge, cancel anytime with no fees,
keep access until the end of the period paid for, and unused prepaid time
returned as credit on early cancellation.

## Legal and policy

RallyHub sells business-to-business (event companies, schools, businesses). The
EU Consumer Rights Directive's mandatory 14-day right of withdrawal applies to
consumers, not business customers, so it does not bind RallyHub's standard
sales. Paddle is Merchant of Record and executes refunds, tax, and chargebacks
under its own buyer terms. The 30-day refund and the credit-on-cancellation are
therefore voluntary goodwill above the legal floor, which is good for trust and
low-risk. The exact policy wording, and any edge case where a sole trader could
count as a consumer, should be checked once before publishing; the direction is
more generous than required, so the risk is low.

## Edge cases

- Cancel during trial: no charge, drop to Pay Per Event, trial marked used, trial
  events stay charged.
- Payment fails at trial end: Paddle `past_due` and retries; org runs as Pay Per
  Event until resolved; no access cut mid-event.
- Second trial attempt after a prior trial: refused by `trial_used_at`.
- Credit larger than a charge: the charge nets to €0 through Paddle where
  possible, the remaining credit stays on the balance.
- Concurrent event activations spending the same credit: prevented by applying
  and recording credit inside the invoice-creating transaction.
- Refund of a subscription that already generated credit: reconcile so the same
  value is not returned twice (cash refund and credit for the same period are
  mutually exclusive).

## Testing

- Unit: unused-whole-month credit maths; credit application to a per-event bill;
  trial eligibility (once per account); gate allows `trialing`, blocks
  `past_due`.
- Integration in Paddle sandbox: start trial (card collected, €0), run a
  per-event charge during trial at the plan rate, simulate day-30 auto-charge,
  cancel-to-credit and verify ledger and balance, spend credit on a later event,
  request and reconcile a refund.
- Regression: Pay Per Event and existing paid-subscription flows unchanged for
  orgs that never touch a trial or credit.

## Out of scope and open implementation questions

- The exact Paddle mechanism for applying credit to a subscription renewal
  (transaction adjustment vs one-time discount) is decided during the plan.
- Pro per-event branding-removal add-on pricing is still undecided and is not
  part of this work.
- Dunning and email copy for `past_due` reuse existing transactional email; no
  new sequence is designed here.
