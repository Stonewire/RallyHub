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
//                             once the paid period ends.
//
// Always returns 200 once the signature is verified, even for event types we
// don't act on — Paddle retries non-2xx responses, and we don't want retries
// for events that are legitimately no-ops for us.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
          await admin
            .from('subscription_transactions')
            .update({ status: 'paid' })
            .eq('paddle_transaction_id', data.id)

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

        const updates: Record<string, unknown> = { paddle_subscription_id: data.id }
        if (typeof data.status === 'string') updates.subscription_status = data.status
        const periodEnd = data.current_billing_period?.ends_at
        if (typeof periodEnd === 'string') updates.subscription_current_period_end = periodEnd
        if (data.customer_id) updates.paddle_customer_id = data.customer_id
        if (typeof custom.plan_key === 'string') updates.billing_plan = custom.plan_key
        if (typeof custom.billing_period === 'string') updates.billing_period = custom.billing_period
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
