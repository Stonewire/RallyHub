// PAY-1: Paddle transactions for RallyHub billing. Four kinds:
//   - kind: 'event'         pay an unpaid per-event invoice via the overlay, for
//                           its exact amount_due (already computed server-side,
//                           including any promo/educational discount).
//   - kind: 'event_verify'  after that overlay completes, confirm payment with
//                           Paddle directly and settle the invoice synchronously
//                           (Free-plan prepay must not race the async webhook).
//   - kind: 'event_auto'    charge an unpaid per-event invoice straight to the
//                           card saved against the org's subscription. Fired
//                           after activation; never fails hard.
//   - kind: 'subscription'  start a plan, applying any active subscription promo
//                           code as a real Paddle Discount.
//
// Prices are always inline/non-catalog so RallyHub's own pricing stays the single
// source of truth; Paddle never holds a duplicated price list.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { requireAuthUser, requireOrgAdminOrSuperAdmin } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-join-token',
}

// Mirrors src/lib/subscription-plans.ts and the DB's plan_per_event_price_eur().
// Keep all three in sync when prices change. Only self-serve paid plans need an
// entry here — Free has no subscription, Enterprise is negotiated directly,
// Partner is comped.
const SUBSCRIPTION_PRICES_EUR: Record<string, { monthly: number; yearly: number }> = {
  arena: { monthly: 20, yearly: 180 },
  pro: { monthly: 30, yearly: 300 },
  max: { monthly: 30, yearly: 300 },
}

const PLAN_NAMES: Record<string, string> = {
  arena: 'Starter',
  pro: 'Pro',
  max: 'Business',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Cents string Paddle expects for unit_price.amount, from a euro amount. */
function toMinorUnits(amountEur: number): string {
  return Math.round(amountEur * 100).toString()
}

type PaddleOrg = {
  id: string
  name: string
  email: string | null
  contact_email: string | null
  educational_status: string | null
  paddle_customer_id: string | null
  paddle_subscription_id: string | null
}

/** Raised when we cannot give Paddle an email — surfaced to the user, not logged as a crash. */
class MissingBillingEmail extends Error {}

async function ensurePaddleCustomer(
  admin: ReturnType<typeof createClient>,
  paddleApiKey: string,
  paddleBaseUrl: string,
  org: PaddleOrg,
  /** Logged-in user's email — the fallback when the org has none of its own. */
  fallbackEmail: string | null,
): Promise<string> {
  if (org.paddle_customer_id) return org.paddle_customer_id

  // A freshly-registered org has neither contact_email nor email set, and Paddle
  // rejects a null email outright ("Expected: string, given: null"). Fall back to
  // the admin who is actually standing at the checkout.
  const email = org.contact_email || org.email || fallbackEmail
  if (!email) {
    throw new MissingBillingEmail(
      'Add a billing email in Settings → Organisation before paying.',
    )
  }

  const res = await fetch(`${paddleBaseUrl}/customers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paddleApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, name: org.name }),
  })

  let customerId: string

  if (res.ok) {
    customerId = (await res.json()).data.id as string
  } else {
    const detail = await res.text()
    // Paddle enforces one customer per email. We can legitimately hit this: an org
    // with no billing email of its own falls back to the admin's login email, and
    // that admin may already own another org. Adopt the existing customer instead
    // of failing the payment.
    const existingId = res.status === 409 ? await findPaddleCustomerByEmail(
      paddleApiKey,
      paddleBaseUrl,
      email,
      detail,
    ) : null

    if (!existingId) {
      throw new Error(`Paddle customer creation failed: ${res.status} ${detail}`)
    }
    customerId = existingId
  }

  await admin.from('organizations').update({ paddle_customer_id: customerId }).eq('id', org.id)
  return customerId
}

/**
 * Resolves the Paddle customer that already owns `email`, after a 409. Asks Paddle
 * properly first; falls back to reading the id out of the conflict message, which
 * spells it out ("...conflicts with customer of id ctm_..."), so a lookup outage
 * still cannot strand someone mid-payment.
 */
async function findPaddleCustomerByEmail(
  paddleApiKey: string,
  paddleBaseUrl: string,
  email: string,
  conflictDetail: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `${paddleBaseUrl}/customers?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${paddleApiKey}` } },
    )
    if (res.ok) {
      const found = (await res.json())?.data?.[0]?.id
      if (typeof found === 'string' && found) return found
    }
  } catch (err) {
    console.error('[paddle-checkout] customer lookup by email failed:', err)
  }

  return conflictDetail.match(/ctm_[a-zA-Z0-9]+/)?.[0] ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    const paddleApiKey = Deno.env.get('PADDLE_API_KEY')
    const paddleEnvironment = Deno.env.get('PADDLE_ENVIRONMENT') === 'production' ? 'production' : 'sandbox'
    const paddleBaseUrl =
      paddleEnvironment === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com'

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[paddle-checkout] missing Supabase env vars')
      return json({ error: 'Server misconfiguration' }, 500)
    }
    if (!paddleApiKey) {
      return json({ error: 'Payment processing is not configured yet.' }, 500)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
    })

    const auth = await requireAuthUser(admin, req.headers.get('Authorization'))
    if (!auth.ok) return json({ error: auth.message }, auth.status)

    const body = await req.json()
    const organizationId = body.organizationId?.trim()
    const kind = body.kind

    const VALID_KINDS = ['event', 'event_auto', 'event_verify', 'subscription', 'portal', 'invoice_pdf']
    if (!organizationId || !VALID_KINDS.includes(kind)) {
      return json({ error: 'organizationId and a valid kind are required' }, 400)
    }

    const orgAuth = await requireOrgAdminOrSuperAdmin(admin, auth.user.id, organizationId)
    if (!orgAuth.ok) return json({ error: orgAuth.message }, orgAuth.status)

    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .select('id, name, email, contact_email, educational_status, paddle_customer_id, paddle_subscription_id')
      .eq('id', organizationId)
      .single()
    if (orgErr || !org) return json({ error: 'Organization not found' }, 404)

    if (kind === 'invoice_pdf') {
      // Paddle is the Merchant of Record, so the legally-valid invoice is Paddle's,
      // not one we generate. Hand back a link to their official PDF.
      //
      // The link is temporary (Paddle expires it after an hour), so it is fetched
      // fresh on each click and never stored. Ownership is checked here as well as
      // by verify_jwt + requireOrgAdminOrSuperAdmin above, so one org can never
      // pull another's invoice by guessing an id.
      const invoiceId = body.invoiceId?.trim()
      if (!invoiceId) return json({ error: 'invoiceId is required' }, 400)

      const { data: invoice } = await admin
        .from('invoices')
        .select('id, organization_id, status, paddle_transaction_id')
        .eq('id', invoiceId)
        .single()

      if (!invoice || invoice.organization_id !== organizationId) {
        return json({ error: 'Invoice not found' }, 404)
      }
      if (!invoice.paddle_transaction_id) {
        // Comped/€0 events, or anything settled outside Paddle, have no Paddle
        // transaction — and Paddle issues no PDF for zero-value transactions.
        return json({ error: 'No downloadable invoice for this event.' }, 404)
      }

      const pdfRes = await fetch(
        `${paddleBaseUrl}/transactions/${invoice.paddle_transaction_id}/invoice`,
        { headers: { Authorization: `Bearer ${paddleApiKey}` } },
      )
      if (!pdfRes.ok) {
        console.error('[paddle-checkout] invoice pdf failed:', pdfRes.status)
        return json({ error: 'Could not fetch the invoice. Please try again.' }, 502)
      }

      const url = (await pdfRes.json())?.data?.url
      if (typeof url !== 'string' || !url) {
        return json({ error: 'Could not fetch the invoice. Please try again.' }, 502)
      }
      return json({ url })
    }

    if (kind === 'portal') {
      // Saved cards / billing details are managed ONLY in Paddle's hosted customer
      // portal. RallyHub never sees, stores or transmits card data — we hold
      // nothing but Paddle's opaque customer id, so there is no card data here to
      // steal. The portal link is minted server-side with the secret API key,
      // is scoped to this one customer, and is short-lived.
      //
      // Access is already restricted above: verify_jwt plus
      // requireOrgAdminOrSuperAdmin, so only an admin of THIS org can mint a link
      // for THIS org's customer. The URL is returned once and never logged,
      // cached or stored.
      const customerId = await ensurePaddleCustomer(
        admin,
        paddleApiKey,
        paddleBaseUrl,
        org,
        auth.user.email ?? null,
      )

      const portalRes = await fetch(
        `${paddleBaseUrl}/customers/${customerId}/portal-sessions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paddleApiKey}`,
            'Content-Type': 'application/json',
          },
          // Passing the subscription gives them the "update payment method" and
          // "cancel" links for it as well as the general overview.
          body: JSON.stringify(
            org.paddle_subscription_id
              ? { subscription_ids: [org.paddle_subscription_id] }
              : {},
          ),
        },
      )

      if (!portalRes.ok) {
        console.error('[paddle-checkout] portal session failed:', portalRes.status)
        return json({ error: 'Could not open billing details. Please try again.' }, 502)
      }

      const url = (await portalRes.json())?.data?.urls?.general?.overview
      if (typeof url !== 'string' || !url) {
        return json({ error: 'Could not open billing details. Please try again.' }, 502)
      }
      return json({ url })
    }

    if (kind === 'event') {
      const invoiceId = body.invoiceId?.trim()
      if (!invoiceId) return json({ error: 'invoiceId is required' }, 400)

      const { data: invoice, error: invErr } = await admin
        .from('invoices')
        .select('id, organization_id, plan_key, amount_due, status')
        .eq('id', invoiceId)
        .single()
      if (invErr || !invoice) return json({ error: 'Invoice not found' }, 404)
      if (invoice.organization_id !== organizationId) {
        return json({ error: 'Invoice does not belong to this organization' }, 403)
      }
      if (invoice.status !== 'unpaid') {
        return json({ error: 'This invoice is already settled.' }, 400)
      }

      const customerId = await ensurePaddleCustomer(admin, paddleApiKey, paddleBaseUrl, org, auth.user.email ?? null)
      const planName = PLAN_NAMES[invoice.plan_key] ?? invoice.plan_key

      const txRes = await fetch(`${paddleBaseUrl}/transactions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paddleApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: customerId,
          currency_code: 'EUR',
          items: [
            {
              quantity: 1,
              price: {
                description: `Event activation — ${planName} plan`,
                name: 'Event activation',
                unit_price: { amount: toMinorUnits(Number(invoice.amount_due)), currency_code: 'EUR' },
                tax_mode: 'account_setting',
                product: { name: 'RallyHub event activation', tax_category: 'standard' },
              },
            },
          ],
          custom_data: { kind: 'event', invoice_id: invoice.id, organization_id: organizationId },
        }),
      })
      if (!txRes.ok) {
        // Paddle's raw error is logged for us, never returned to the browser — it
        // leaks internal plumbing (error codes, request ids, config hints) to a
        // customer who has no use for it. Read it in Supabase → Edge Functions → Logs.
        console.error('[paddle-checkout] event transaction create failed:', txRes.status, await txRes.text())
        return json({ error: 'Could not start payment. Please try again.' }, 502)
      }
      const txBody = await txRes.json()
      const transactionId = txBody.data.id as string

      await admin.from('invoices').update({ paddle_transaction_id: transactionId }).eq('id', invoice.id)
      return json({ transactionId })
    }

    if (kind === 'event_verify') {
      // Free-plan prepay: the customer has just completed the overlay checkout and
      // we are about to activate their event, but the activation gate requires the
      // invoice to be PAID. The webhook that marks it paid is asynchronous, so
      // waiting on it would be a race. Ask Paddle directly instead and settle the
      // invoice synchronously. Idempotent: the webhook doing the same thing later
      // is a no-op (the .eq('status','unpaid') guard).
      const invoiceId = body.invoiceId?.trim()
      if (!invoiceId) return json({ error: 'invoiceId is required' }, 400)

      const { data: invoice } = await admin
        .from('invoices')
        .select('id, organization_id, status, paddle_transaction_id')
        .eq('id', invoiceId)
        .single()

      if (!invoice || invoice.organization_id !== organizationId) {
        return json({ error: 'Invoice not found' }, 404)
      }
      // Already settled (webhook beat us, or a 100% promo comped it).
      if (invoice.status === 'paid' || invoice.status === 'comped') {
        return json({ paid: true })
      }
      if (!invoice.paddle_transaction_id) return json({ paid: false })

      const txRes = await fetch(
        `${paddleBaseUrl}/transactions/${invoice.paddle_transaction_id}`,
        { headers: { Authorization: `Bearer ${paddleApiKey}` } },
      )
      if (!txRes.ok) {
        console.error('[paddle-checkout] verify fetch failed:', txRes.status, await txRes.text())
        return json({ paid: false })
      }

      const status = (await txRes.json())?.data?.status as string | undefined
      // Paddle marks a settled transaction 'completed' (or 'paid'). Anything else
      // (draft/ready/billed/past_due/canceled) is not money in the bank.
      const paid = status === 'completed' || status === 'paid'
      if (paid) {
        await admin
          .from('invoices')
          .update({ status: 'paid' })
          .eq('id', invoice.id)
          .eq('status', 'unpaid')
      }
      return json({ paid })
    }

    if (kind === 'event_auto') {
      // Fire-and-forget auto-charge of a per-event invoice to the payment method
      // already saved against the org's subscription. Called right after an event
      // activates. This must NEVER fail hard: the event is already live, and the
      // invoice stays payable via "Pay now" if this doesn't land. Any problem
      // returns 200 + charged:false rather than an error.
      const invoiceId = body.invoiceId?.trim()
      if (!invoiceId) return json({ charged: false, reason: 'no_invoice' })

      const { data: invoice } = await admin
        .from('invoices')
        .select('id, organization_id, plan_key, amount_due, status')
        .eq('id', invoiceId)
        .single()

      if (!invoice || invoice.organization_id !== organizationId) {
        return json({ charged: false, reason: 'not_found' })
      }
      if (invoice.status !== 'unpaid' || Number(invoice.amount_due) <= 0) {
        return json({ charged: false, reason: 'nothing_due' })
      }
      if (!org.paddle_subscription_id) {
        // Free plan, or a paid plan that has not subscribed — nothing to charge
        // against. They settle the invoice manually.
        return json({ charged: false, reason: 'no_subscription' })
      }

      const planName = PLAN_NAMES[invoice.plan_key] ?? invoice.plan_key
      const chargeRes = await fetch(
        `${paddleBaseUrl}/subscriptions/${org.paddle_subscription_id}/charge`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paddleApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            effective_from: 'immediately',
            items: [
              {
                quantity: 1,
                price: {
                  description: `Event activation — ${planName} plan`,
                  name: 'Event activation',
                  unit_price: {
                    amount: toMinorUnits(Number(invoice.amount_due)),
                    currency_code: 'EUR',
                  },
                  tax_mode: 'account_setting',
                  product: { name: 'RallyHub event activation', tax_category: 'standard' },
                  // A one-time subscription charge cannot carry transaction-level
                  // custom_data, so stamp it on the price — the webhook reads it
                  // back from items[].price.custom_data to settle this invoice.
                  custom_data: {
                    kind: 'event',
                    invoice_id: invoice.id,
                    organization_id: organizationId,
                  },
                },
              },
            ],
          }),
        },
      )

      if (!chargeRes.ok) {
        console.error(
          '[paddle-checkout] event auto-charge failed:',
          chargeRes.status,
          await chargeRes.text(),
        )
        return json({ charged: false, reason: 'charge_failed' })
      }
      // transaction.completed will mark the invoice paid.
      return json({ charged: true })
    }

    // kind === 'subscription'
    const planId = body.planId
    const billingPeriod = body.billingPeriod === 'monthly' ? 'monthly' : 'yearly'
    const prices = SUBSCRIPTION_PRICES_EUR[planId]
    if (!prices) return json({ error: 'Invalid plan.' }, 400)

    if (org.paddle_subscription_id) {
      return json(
        { error: 'This organization already has an active subscription. Contact support to change plans.' },
        400,
      )
    }

    const planName = PLAN_NAMES[planId] ?? planId

    // The educational 50% is permanent for as long as the org stays approved, so
    // it is baked straight into the recurring price.
    let amountEur = billingPeriod === 'monthly' ? prices.monthly : prices.yearly
    if (org.educational_status === 'approved') amountEur = Math.round(amountEur / 2)

    // A subscription promo code can be time-limited (duration_months), so it can
    // NOT be baked into the recurring price — that would discount every renewal
    // forever. Paddle's Discount object handles the recurrence properly.
    const { data: redemption } = await admin
      .from('promo_code_redemptions')
      .select('id, promo_code_id, discount_percent, duration_months')
      .eq('organization_id', organizationId)
      .eq('purpose', 'subscription')
      .eq('status', 'active')
      .order('discount_percent', { ascending: false })
      .limit(1)
      .maybeSingle()

    const discountPercent = Number(redemption?.discount_percent ?? 0)
    let discountId: string | null = null

    if (redemption && discountPercent > 0) {
      // duration_months is in months; Paddle counts BILLING PERIODS. On a yearly
      // plan a sub-year duration cannot be expressed, so it rounds to whole years
      // (minimum one). Omitting the field means "discount every renewal".
      const durationMonths = redemption.duration_months as number | null
      let maxIntervals: number | null = null
      if (durationMonths && durationMonths > 0) {
        maxIntervals =
          billingPeriod === 'monthly'
            ? durationMonths
            : Math.max(1, Math.round(durationMonths / 12))
      }

      const discRes = await fetch(`${paddleBaseUrl}/discounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paddleApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: `RallyHub promo — ${discountPercent}% off ${planName} (${billingPeriod})`,
          type: 'percentage',
          amount: String(discountPercent),
          // Redeemed inside RallyHub, never typed into Paddle's checkout.
          enabled_for_checkout: false,
          recur: true,
          ...(maxIntervals ? { maximum_recurring_intervals: maxIntervals } : {}),
        }),
      })

      if (discRes.ok) {
        const discBody = await discRes.json()
        discountId = discBody.data.id as string
      } else {
        // Do not fail the checkout over a discount we could not create — log it
        // and let them subscribe at full price rather than blocking the sale.
        // The redemption stays 'active', so it can still be applied later.
        console.error(
          '[paddle-checkout] discount create failed:',
          discRes.status,
          await discRes.text(),
        )
      }
    }

    const customerId = await ensurePaddleCustomer(admin, paddleApiKey, paddleBaseUrl, org, auth.user.email ?? null)

    const txRes = await fetch(`${paddleBaseUrl}/transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paddleApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: customerId,
        currency_code: 'EUR',
        ...(discountId ? { discount_id: discountId } : {}),
        items: [
          {
            quantity: 1,
            price: {
              description: `RallyHub ${planName} subscription (${billingPeriod})`,
              name: `${planName} — ${billingPeriod}`,
              billing_cycle: { interval: billingPeriod === 'monthly' ? 'month' : 'year', frequency: 1 },
              unit_price: { amount: toMinorUnits(amountEur), currency_code: 'EUR' },
              tax_mode: 'account_setting',
              product: { name: `RallyHub ${planName}`, tax_category: 'standard' },
            },
          },
        ],
        custom_data: {
          kind: 'subscription',
          organization_id: organizationId,
          plan_key: planId,
          billing_period: billingPeriod,
          // Consumed by the webhook once payment actually completes — marking it
          // used here would burn the code on an abandoned checkout.
          promo_redemption_id: discountId ? redemption?.id ?? null : null,
        },
      }),
    })
    if (!txRes.ok) {
      // Logged, not returned — see the note on the event branch above.
      console.error('[paddle-checkout] subscription transaction create failed:', txRes.status, await txRes.text())
      return json({ error: 'Could not start checkout. Please try again.' }, 502)
    }
    const txBody = await txRes.json()
    const transactionId = txBody.data.id as string

    // amount = list price after the permanent educational discount; amount_due =
    // what Paddle will actually collect once the promo discount is applied.
    const amountDue = discountId
      ? Math.round(amountEur * (1 - discountPercent / 100) * 100) / 100
      : amountEur

    const { error: subTxErr } = await admin.from('subscription_transactions').insert({
      organization_id: organizationId,
      paddle_transaction_id: transactionId,
      plan_key: planId,
      billing_period: billingPeriod,
      amount: amountEur,
      amount_due: amountDue,
      currency: 'EUR',
      status: 'pending',
    })
    if (subTxErr) {
      console.error('[paddle-checkout] subscription_transactions insert failed:', subTxErr.message)
    }

    return json({ transactionId })
  } catch (err) {
    // A missing billing email is a user-fixable setup problem, not a server fault,
    // and its message is written for the customer. It is the ONLY error whose text
    // we hand back.
    if (err instanceof MissingBillingEmail) {
      return json({ error: err.message }, 400)
    }
    // Everything else is logged and answered generically. Returning err.message
    // here would echo raw upstream failures to the browser — that is how a Paddle
    // 409 ended up showing the customer Paddle's internal error body, complete with
    // another customer's id. Read the real cause in Supabase → Edge Functions → Logs.
    console.error('[paddle-checkout] unexpected:', err)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
