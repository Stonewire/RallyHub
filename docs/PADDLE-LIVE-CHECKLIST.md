# Paddle sandbox-to-live checklist

Last reviewed: 15 July 2026

RallyHub currently supports both Paddle environments. The browser uses
`VITE_PADDLE_ENVIRONMENT`; Supabase Edge Functions use `PADDLE_ENVIRONMENT`.
Sandbox and live Paddle are completely separate systems, so live credentials,
webhooks, customers, subscriptions, and transaction IDs must not be mixed.

## What does not need to be recreated

RallyHub sends inline, non-catalog products and prices when it creates a Paddle
transaction. The pricing source of truth is the application and database, not
a duplicated Paddle product catalogue. There are therefore no sandbox Paddle
price IDs to copy into live.

## 1. Prepare the live Paddle account

In Paddle live mode:

1. Complete business and identity verification and make sure Paddle Billing is
   enabled for the live account.
2. Submit the production website/domain for approval.
3. Configure the default payment link to an approved production page that loads
   Paddle.js. For RallyHub, confirm the final tenant billing URL before entering
   it; do not point this at localhost or a sandbox domain.
4. Review checkout branding, statement descriptor, refund policy, support
   details, EUR balance/currency settings, payment methods, and invoice details.
5. Set sales-tax display to VAT-exclusive, matching RallyHub's current pricing
   copy.
6. Create a **live API key** with access to customers, transactions,
   subscriptions, discounts, invoice PDFs, and customer portal sessions.
7. Create a **live client-side token**. A production token starts with `live_`;
   it is the only Paddle credential allowed in Vercel/browser variables.

Never place the Paddle API key or webhook signing secret in Vercel or source
control.

## 2. Create the live webhook destination

Create a notification destination pointing to:

`https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/paddle-webhook`

Subscribe it to every event handled by RallyHub:

- `transaction.completed`
- `transaction.payment_failed`
- `subscription.created`
- `subscription.updated`
- `subscription.activated`
- `subscription.canceled`
- `subscription.paused`
- `subscription.past_due`
- `subscription.resumed`

Copy that live destination's endpoint signing secret into the Supabase Edge
Function secret `PADDLE_WEBHOOK_SECRET`. The sandbox webhook secret cannot
verify live events.

## 3. Audit and remove sandbox references

Sandbox customer and subscription IDs do not exist in live Paddle. Before the
first live checkout, inventory every organization with `paddle_customer_id` or
`paddle_subscription_id`. Clear sandbox IDs and sandbox subscription state only
for confirmed test organizations. Also decide whether sandbox invoices and
`subscription_transactions` should be retained as internal test history or
removed.

Do not run a blanket destructive update without first exporting the affected
rows. A live organization must never have a sandbox `ctm_`, `sub_`, or `txn_`
reference attached to it. On its first live subscription checkout, RallyHub will
store the newly created live customer and subscription IDs through the signed
webhook.

## 4. Deploy the release while still in sandbox mode

Before changing credentials:

1. Deploy the production application code.
2. Apply migrations
   `20260715130127_remove_automatic_first_event_free.sql` and
   `20260715134305_data_lifecycle_and_pricing.sql`.
3. Deploy `paddle-checkout`, `paddle-webhook`, and `data-lifecycle`.
4. Configure the Storage lifecycle Vault and cron values using
   `docs/DATA-LIFECYCLE.md`.
5. Keep both plan-change flags false during the first live-payment smoke test:
   `VITE_ENABLE_PLAN_CHANGES=false` and `ENABLE_PLAN_CHANGES=false`.

This order lets the already-tested code reach production without combining the
deployment itself with the credential cutover.

## 5. Switch both sides in one short maintenance window

Avoid accepting checkouts while the browser and Edge Functions point to
different Paddle environments.

Set these Supabase Edge Function secrets together:

```text
PADDLE_ENVIRONMENT=production
PADDLE_API_KEY=<live API key>
PADDLE_WEBHOOK_SECRET=<live notification-destination secret>
ENABLE_PLAN_CHANGES=false
```

Then set these Vercel production variables and redeploy immediately:

```text
VITE_PADDLE_ENVIRONMENT=production
VITE_PADDLE_CLIENT_TOKEN=<live_ client-side token>
VITE_ENABLE_PLAN_CHANGES=false
```

Keep the sandbox credentials saved securely outside the application in case a
separate sandbox deployment is used later. Never put both environments' secret
keys into the same production configuration.

## 6. Run one real live smoke test

Live mode does not accept Paddle sandbox test cards. Use an authorized real
payment and refund it afterward if appropriate.

Verify, in order:

1. A Starter monthly subscription checkout opens with the expected €20 price
   plus the configured tax treatment.
2. `subscription.created`/`activated` reaches the live webhook and the
   organization receives live customer/subscription IDs, `active` status, plan,
   period, and paid-through date.
3. The organization can open Paddle's customer portal.
4. Event activation creates the correct €149 invoice and the saved-payment-method
   auto-charge completes without delaying the live event.
5. `transaction.completed` marks the event invoice paid and its Paddle invoice
   PDF can be opened.
6. A Free-plan event produces €199, Pro produces €99, and Business produces €95
   in controlled checks; do not complete unnecessary charges.
7. Account deletion schedules renewal cancellation and restore reverses that
   schedule before testing permanent deletion on a disposable organization.

Only after the live payment, webhook, portal, and subscription lifecycle are
confirmed should both plan-change flags be enabled together.

## Rollback boundary

If the first live checkout or webhook fails, disable checkout access and return
both browser and Edge Function environment settings to sandbox together. Do not
attach live IDs to a sandbox configuration or vice versa. Correct the live
destination/secrets, clear only the failed test organization's invalid local
references, and repeat the smoke test.

## Official Paddle references

- https://developer.paddle.com/build/set-up-checklist
- https://developer.paddle.com/build/go-live-checklist
- https://developer.paddle.com/sdks/sandbox
- https://developer.paddle.com/build/transactions/default-payment-link
- https://developer.paddle.com/paddle-js/about/client-side-tokens
