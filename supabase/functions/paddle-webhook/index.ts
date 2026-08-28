// PAY-1: receives Paddle Billing webhooks. Public endpoint (deployed with
// verify_jwt=false — Paddle has no Supabase session, it authenticates itself
// via the Paddle-Signature header instead, verified below).
//
// Handles:
//   transaction.completed   → marks the matching invoice/subscription_transactions
//                             row paid (does not touch invoices already
//                             comped/paid, and only ones actually created here).
//   transaction.payment_failed → marks the matching subscription_transactions row failed.
//   subscription.created /
//   subscription.updated    → sync the org's billing_plan/billing_period/
//                             paddle_subscription_id/paddle_customer_id plus
//                             subscription_status and subscription_current_period_end
//                             (the paid-through date the activation gate checks).
//                             custom_data (organization_id, plan_key, billing_period)
//                             is inherited from the transaction that created it.
//   subscription.canceled /
//   subscription.paused     → record the new status so the gate blocks activation
//                             once the paid period ends. A canceled subscription
//                             also clears paddle_subscription_id and never
//                             re-asserts plan_key/billing_period from custom_data,
//                             so a refund-driven downgrade (below) is not undone.
//   adjustment.created /
//   adjustment.updated      → refunds (action 'refund', status 'approved').
//                             Only a FULL refund changes state (Rumen's rule:
//                             refund = stop billing; a partial goodwill refund
//                             is logged and touches nothing). A fully refunded
//                             subscription payment cancels the Paddle
//                             subscription FIRST, then marks the matching
//                             subscription_transactions row canceled and
//                             downgrades the org to the free plan. Renewal
//                             payments have no local row, so they resolve via
//                             the Paddle API instead. A fully refunded event
//                             payment marks the matching invoice 'refunded'.
//
// Always returns 200 once the signature is verified, even for event types we
// don't act on: Paddle retries non-2xx responses, and we don't want retries
// for events that are legitimately no-ops for us. The ONE deliberate exception
// is a full refund whose Paddle subscription cancel call fails, which answers
// 500 so Paddle's retry schedule re-delivers until the cancel lands (safe:
// an already-canceled subscription short-circuits to success on re-delivery).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// The slice of a Paddle GET /transactions/{id} response the refund path
// relies on. Amounts are strings of minor currency units.
type PaddleTransaction = {
  id?: string
  subscription_id?: string | null
  custom_data?: Record<string, unknown> | null
  details?: {
    totals?: { total?: string | null; grand_total?: string | null } | null
  } | null
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Verifies the Paddle-Signature header against the raw body. Must be called
 * with the exact raw request body text — no JSON.parse/reformatting before
 * this, or the signature will never match.
 */
async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const parts: Record<string, string> = {}
  for (const part of signatureHeader.split(';')) {
    const [key, value] = part.split('=')
    if (key && value) parts[key] = value
  }
  const ts = parts.ts
  const h1 = parts.h1
  if (!ts || !h1) return false

  // Generous 5-minute window — allows for clock drift and Paddle's own
  // retries, while still rejecting genuinely stale/replayed requests.
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(ts))
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false

  const signedPayload = `${ts}:${rawBody}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  const computedHex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return timingSafeEqualHex(computedHex, h1)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const webhookSecret = Deno.env.get('PADDLE_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''

  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('[paddle-webhook] missing env vars')
    return new Response('Server misconfiguration', { status: 500 })
  }

  const rawBody = await req.text()
  const signatureHeader = req.headers.get('paddle-signature')
  if (!signatureHeader || !(await verifyPaddleSignature(rawBody, signatureHeader, webhookSecret))) {
    console.error('[paddle-webhook] invalid or missing signature')
    return new Response('Invalid signature', { status: 401 })
  }

  let event: {
    event_type?: string
    data?: {
      id?: string
      customer_id?: string
      subscription_id?: string | null
      status?: string
      // Adjustment events (refunds) reference the transaction they adjust.
      // type is 'full' | 'partial'; totals carry minor-unit string amounts.
      action?: string
      type?: string
      transaction_id?: string | null
      totals?: { total?: string | null; currency_code?: string | null } | null
      current_billing_period?: { starts_at?: string; ends_at?: string } | null
      items?: Array<{ price?: { custom_data?: Record<string, unknown> | null } | null }> | null
      custom_data?: Record<string, unknown> | null
    }
  }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
  })

  try {
    const data = event.data ?? {}
    // A one-time subscription charge (the per-event auto-charge) cannot carry
    // transaction-level custom_data, so paddle-checkout stamps it on the inline
    // price instead. Transaction-level wins where both exist.
    const priceCustom = data.items?.[0]?.price?.custom_data ?? {}
    const custom = { ...priceCustom, ...(data.custom_data ?? {}) }

    switch (event.event_type) {
      case 'transaction.completed': {
        if (custom.kind === 'event' && typeof custom.invoice_id === 'string') {
          // Store the transaction id as well as marking it paid. An auto-charged
          // invoice never went through the overlay, so this is the only place its
          // transaction gets recorded — and without it there is nothing to fetch
          // the invoice PDF from later.
          await admin
            .from('invoices')
            .update({ status: 'paid', ...(data.id ? { paddle_transaction_id: data.id } : {}) })
            .eq('id', custom.invoice_id)
            .eq('status', 'unpaid')
        } else if (custom.kind === 'subscription' && data.id) {
          // Backfill the subscription this payment belongs to: the checkout
          // insert happens before Paddle creates the subscription, so this is
          // the only place the link can be recorded, and the refund path's
          // superseded-subscription guard depends on it. The status guard
          // keeps a replayed completion from flipping a canceled (refunded)
          // payment back to paid.
          await admin
            .from('subscription_transactions')
            .update({
              status: 'paid',
              ...(typeof data.subscription_id === 'string' && data.subscription_id
                ? { paddle_subscription_id: data.subscription_id }
                : {}),
            })
            .eq('paddle_transaction_id', data.id)
            .neq('status', 'canceled')

          // The promo code is only consumed once the customer has actually paid.
          if (typeof custom.promo_redemption_id === 'string') {
            await admin
              .from('promo_code_redemptions')
              .update({ status: 'used', applied_at: new Date().toISOString() })
              .eq('id', custom.promo_redemption_id)
              .eq('status', 'active')
          }
        }
        break
      }

      case 'transaction.payment_failed': {
        if (custom.kind === 'subscription' && data.id) {
          await admin
            .from('subscription_transactions')
            .update({ status: 'failed' })
            .eq('paddle_transaction_id', data.id)
        }
        break
      }

      case 'subscription.created':
      case 'subscription.updated':
      case 'subscription.activated':
      case 'subscription.canceled':
      case 'subscription.paused':
      case 'subscription.past_due':
      case 'subscription.resumed': {
        if (!data.id) break

        // A canceled subscription is gone: clear the stored id and never
        // re-assert plan_key/billing_period from its custom_data, or this
        // backstop would undo the refund-driven downgrade below.
        const subscriptionCanceled = data.status === 'canceled'
        const updates: Record<string, unknown> = {
          paddle_subscription_id: subscriptionCanceled ? null : data.id,
        }
        if (typeof data.status === 'string') updates.subscription_status = data.status
        const periodEnd = data.current_billing_period?.ends_at
        if (typeof periodEnd === 'string') updates.subscription_current_period_end = periodEnd
        if (data.customer_id) updates.paddle_customer_id = data.customer_id
        if (!subscriptionCanceled && typeof custom.plan_key === 'string') updates.billing_plan = custom.plan_key
        if (!subscriptionCanceled && typeof custom.billing_period === 'string') updates.billing_period = custom.billing_period
        // Keep the org marked active while the subscription is usable.
        if (data.status === 'active' || data.status === 'trialing') updates.account_status = 'active'

        // Prefer the organization_id we stamped on the transaction; fall back to
        // matching the subscription id already stored on the org.
        if (typeof custom.organization_id === 'string') {
          await admin.from('organizations').update(updates).eq('id', custom.organization_id)
        } else {
          await admin.from('organizations').update(updates).eq('paddle_subscription_id', data.id)
        }
        break
      }

      case 'adjustment.created':
      case 'adjustment.updated': {
        // Refunds arrive as adjustments. Only an approved refund moves money
        // back, so anything else (credits, chargebacks, pending or rejected
        // refunds) is acknowledged and left alone. adjustment.created can
        // already carry status 'approved'; otherwise the approval arrives
        // later as adjustment.updated. Every write below is idempotent, so a
        // created/updated pair for the same refund is safe.
        const transactionId = data.transaction_id
        if (data.action !== 'refund' || data.status !== 'approved') break
        if (typeof transactionId !== 'string' || !transactionId) break

        const paddleApiKey = Deno.env.get('PADDLE_API_KEY')
        const paddleBaseUrl = Deno.env.get('PADDLE_ENVIRONMENT') === 'production'
          ? 'https://api.paddle.com'
          : 'https://sandbox-api.paddle.com'

        // The refunded transaction, fetched from the Paddle API at most once
        // and only when actually needed: to derive full vs partial when the
        // adjustment carries no type, to resolve renewal payments that have
        // no local row, and to find which subscription a legacy payment row
        // (inserted before the paddle_subscription_id backfill) belongs to.
        let paddleTx: PaddleTransaction | null | undefined
        const fetchPaddleTransaction = async (): Promise<PaddleTransaction | null> => {
          if (paddleTx !== undefined) return paddleTx
          paddleTx = null
          if (!paddleApiKey) {
            console.error('[paddle-webhook] PADDLE_API_KEY missing, cannot look up transaction', transactionId)
            return paddleTx
          }
          try {
            const txRes = await fetch(`${paddleBaseUrl}/transactions/${transactionId}`, {
              headers: { Authorization: `Bearer ${paddleApiKey}` },
            })
            if (txRes.ok) {
              const body = await txRes.json()
              paddleTx = (body?.data ?? null) as PaddleTransaction | null
            } else {
              console.error('[paddle-webhook] transaction lookup failed:', txRes.status, await txRes.text())
            }
          } catch (lookupErr) {
            console.error('[paddle-webhook] transaction lookup failed:', lookupErr)
          }
          return paddleTx
        }

        // Only a FULL refund stops billing (refund = stop billing). A partial
        // goodwill refund is logged and must not kill the plan or the invoice.
        // When the adjustment carries no explicit type, compare its total
        // against what the transaction actually charged.
        let isFullRefund: boolean | null =
          data.type === 'full' ? true : data.type === 'partial' ? false : null
        if (isFullRefund === null) {
          const tx = await fetchPaddleTransaction()
          const refundedTotal = Number(data.totals?.total)
          const chargedTotal = Number(tx?.details?.totals?.grand_total ?? tx?.details?.totals?.total)
          if (tx && Number.isFinite(refundedTotal) && Number.isFinite(chargedTotal)) {
            isFullRefund = refundedTotal >= chargedTotal
          }
        }
        if (isFullRefund === false) {
          console.log('[paddle-webhook] partial refund on transaction', transactionId, 'acknowledged, no state change')
          break
        }
        if (isFullRefund === null) {
          console.error('[paddle-webhook] could not determine full vs partial for refund on transaction', transactionId, '- nothing changed, handle manually')
          break
        }

        // Cancels the subscription at Paddle. An already-canceled
        // subscription counts as success, which is what makes the retry loop
        // below (500 → Paddle re-delivery) converge instead of spin.
        const cancelPaddleSubscription = async (subscriptionId: string): Promise<boolean> => {
          if (!paddleApiKey) {
            console.error('[paddle-webhook] PADDLE_API_KEY missing, cannot cancel subscription after refund:', subscriptionId)
            return false
          }
          try {
            const cancelRes = await fetch(`${paddleBaseUrl}/subscriptions/${subscriptionId}/cancel`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${paddleApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ effective_from: 'immediately' }),
            })
            if (cancelRes.ok) return true
            const cancelErrText = await cancelRes.text()
            // Paddle rejects canceling an already-canceled subscription.
            // Check the live status instead of pattern-matching error codes.
            const checkRes = await fetch(`${paddleBaseUrl}/subscriptions/${subscriptionId}`, {
              headers: { Authorization: `Bearer ${paddleApiKey}` },
            })
            if (checkRes.ok) {
              const checkBody = await checkRes.json()
              if (checkBody?.data?.status === 'canceled') return true
            }
            console.error('[paddle-webhook] canceling subscription after refund failed:', cancelRes.status, cancelErrText)
          } catch (cancelErr) {
            console.error('[paddle-webhook] canceling subscription after refund failed:', cancelErr)
          }
          return false
        }

        // Full-refund downgrade, shared by the local-row and renewal paths.
        // Order matters: cancel at Paddle FIRST, and only after that succeeds
        // touch our rows. On cancel failure THIS branch alone returns 500
        // (the signature was already verified above, so only genuine Paddle
        // deliveries can trigger it) so Paddle's retry schedule re-delivers
        // until the cancel lands. Every other branch keeps the never-500
        // philosophy: this is the one place where giving up would leave a
        // zombie subscription that keeps charging a refunded customer.
        // Re-delivery is idempotent: an already-canceled subscription
        // short-circuits to success and both DB writes repeat harmlessly.
        const runFullRefundDowngrade = async (
          org: { id: string; paddle_subscription_id: string | null; subscription_status: string | null },
          subTxId: string | null,
        ): Promise<Response | null> => {
          if (org.paddle_subscription_id && org.subscription_status !== 'canceled') {
            const canceled = await cancelPaddleSubscription(org.paddle_subscription_id)
            if (!canceled) {
              return new Response('Refund subscription cancel failed, retry', { status: 500 })
            }
          }
          if (subTxId) {
            await admin
              .from('subscription_transactions')
              .update({ status: 'canceled' })
              .eq('id', subTxId)
          }
          // billing_period stays as-is: the column is NOT NULL with a
          // monthly/yearly check, and it is meaningless on the free plan.
          //
          // The custom-subscription columns clear WITH the refund: a fully
          // refunded custom subscription must not keep granting its
          // entitlements (unlimited events, negotiated per-event price). The
          // column guard admits this write because the webhook runs as
          // service_role. A NORMAL cancellation deliberately keeps the
          // negotiated terms for a future resubscribe, so the
          // subscription.canceled backstop above does not clear them; only
          // this refund-driven path does.
          await admin
            .from('organizations')
            .update({
              billing_plan: 'rookie',
              subscription_status: 'canceled',
              paddle_subscription_id: null,
              custom_subscription_price_eur: null,
              custom_subscription_period: null,
              custom_per_event_price_eur: null,
            })
            .eq('id', org.id)
          return null
        }

        // Subscription payment refund → mark the payment canceled and
        // downgrade the org (Rumen's decision: automatic, no review step).
        const { data: subTx } = await admin
          .from('subscription_transactions')
          .select('id, organization_id, paddle_subscription_id')
          .eq('paddle_transaction_id', transactionId)
          .maybeSingle()

        if (subTx) {
          const { data: org } = await admin
            .from('organizations')
            .select('id, is_demo, paddle_subscription_id, subscription_status')
            .eq('id', subTx.organization_id)
            .maybeSingle()

          // Never touch a demo org: its billing rows are seeded props. This
          // check runs before ANY write, including the payment row itself.
          if (!org || org.is_demo) break

          // A refund may only take down the subscription it actually paid
          // for. Resolve the payment's subscription (stamped on the row by
          // transaction.completed; older rows fall back to the API) and
          // require a match with the org's CURRENT subscription.
          let refundedSubscriptionId = subTx.paddle_subscription_id
          if (!refundedSubscriptionId) {
            const tx = await fetchPaddleTransaction()
            refundedSubscriptionId = typeof tx?.subscription_id === 'string' ? tx.subscription_id : null
          }

          if (
            !org.paddle_subscription_id ||
            !refundedSubscriptionId ||
            refundedSubscriptionId !== org.paddle_subscription_id
          ) {
            // Superseded subscription, an already-processed re-delivery (the
            // org's subscription id is cleared), or an unresolvable payment:
            // record the refund on the payment row, leave the org alone.
            await admin
              .from('subscription_transactions')
              .update({ status: 'canceled' })
              .eq('id', subTx.id)
            console.error(
              '[paddle-webhook] refund on transaction', transactionId,
              'for subscription', refundedSubscriptionId,
              'does not match org', org.id,
              'current subscription', org.paddle_subscription_id,
              '- payment marked canceled, org untouched',
            )
            break
          }

          const retryResponse = await runFullRefundDowngrade(org, subTx.id)
          if (retryResponse) return retryResponse
          break
        }

        // Event payment refund → mark the invoice refunded. Only a paid
        // invoice can be refunded; comped/unpaid rows are left untouched.
        const { data: invoice } = await admin
          .from('invoices')
          .select('id')
          .eq('paddle_transaction_id', transactionId)
          .maybeSingle()
        if (invoice) {
          await admin
            .from('invoices')
            .update({ status: 'refunded' })
            .eq('id', invoice.id)
            .eq('status', 'paid')
          break
        }

        // No local row at all: a renewal payment. Renewal transactions are
        // created by Paddle, not paddle-checkout, so subscription_transactions
        // never has a row for them. Resolve the org through the Paddle API
        // and run the same full-refund downgrade.
        const renewalTx = await fetchPaddleTransaction()
        const renewalSubscriptionId =
          typeof renewalTx?.subscription_id === 'string' ? renewalTx.subscription_id : null
        if (!renewalSubscriptionId) {
          console.error('[paddle-webhook] refund on transaction', transactionId, 'matches no local row and no subscription on the Paddle transaction, ignored')
          break
        }

        // Matching by CURRENT paddle_subscription_id doubles as the
        // superseded-subscription guard: a refund for a subscription no org
        // holds any more matches nothing and changes nothing.
        const { data: renewalOrg } = await admin
          .from('organizations')
          .select('id, is_demo, paddle_subscription_id, subscription_status')
          .eq('paddle_subscription_id', renewalSubscriptionId)
          .maybeSingle()
        if (!renewalOrg) {
          console.error('[paddle-webhook] refund for renewal of subscription', renewalSubscriptionId, 'matches no org, ignored')
          break
        }
        const renewalTxOrgId = renewalTx?.custom_data?.organization_id
        if (typeof renewalTxOrgId === 'string' && renewalTxOrgId !== renewalOrg.id) {
          console.error('[paddle-webhook] refund for renewal of subscription', renewalSubscriptionId, 'failed the org cross-check:', renewalTxOrgId, 'vs', renewalOrg.id, '- ignored')
          break
        }
        // Never touch a demo org: its billing rows are seeded props.
        if (renewalOrg.is_demo) break

        const renewalRetryResponse = await runFullRefundDowngrade(renewalOrg, null)
        if (renewalRetryResponse) return renewalRetryResponse
        break
      }

      default:
        // Unhandled event types are acknowledged, not treated as errors.
        break
    }
  } catch (err) {
    // Signature already verified, so this is a real event — log it, but still
    // return 200 rather than trigger Paddle's retry loop for a DB hiccup.
    console.error('[paddle-webhook] handling error:', err, 'event_type:', event.event_type)
  }

  return new Response('ok', { status: 200 })
})
