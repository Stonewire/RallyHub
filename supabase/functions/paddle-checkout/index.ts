// PAY-1: creates a Paddle transaction and returns its id so the frontend can
// open the Paddle.js overlay checkout for it. Two kinds:
//   - kind: 'event'        pay an existing unpaid per-event invoice, for its
//                          exact amount_due (already computed server-side by
//                          create_event_activation_invoice, including any
//                          promo/educational discount).
//   - kind: 'subscription' start paying for a plan (org must not already have
//                          an active Paddle subscription — changing an
//                          existing subscription's plan is not built yet).
//
// The Paddle transaction always carries a custom, non-catalog price (an
// inline amount, not a pre-created Paddle Price ID) so RallyHub's own pricing
// stays the single source of truth; Paddle's dashboard only needs a customer
// and a product for reporting, never a duplicated price list.
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

async function ensurePaddleCustomer(
  admin: ReturnType<typeof createClient>,
  paddleApiKey: string,
  paddleBaseUrl: string,
  org: PaddleOrg,
): Promise<string> {
  if (org.paddle_customer_id) return org.paddle_customer_id

  const res = await fetch(`${paddleBaseUrl}/customers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paddleApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: org.contact_email ?? org.email,
      name: org.name,
    }),
  })
  if (!res.ok) {
    throw new Error(`Paddle customer creation failed: ${res.status} ${await res.text()}`)
  }
  const body = await res.json()
  const customerId = body.data.id as string
  await admin.from('organizations').update({ paddle_customer_id: customerId }).eq('id', org.id)
  return customerId
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

    if (!organizationId || (kind !== 'event' && kind !== 'subscription')) {
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

      const customerId = await ensurePaddleCustomer(admin, paddleApiKey, paddleBaseUrl, org)
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
        const detail = await txRes.text()
        console.error('[paddle-checkout] event transaction create failed:', txRes.status, detail)
        return json({ error: 'Could not start payment. Please try again.', detail }, 502)
      }
      const txBody = await txRes.json()
      const transactionId = txBody.data.id as string

      await admin.from('invoices').update({ paddle_transaction_id: transactionId }).eq('id', invoice.id)
      return json({ transactionId })
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

    let amountEur = billingPeriod === 'monthly' ? prices.monthly : prices.yearly
    if (org.educational_status === 'approved') amountEur = Math.round(amountEur / 2)

    const customerId = await ensurePaddleCustomer(admin, paddleApiKey, paddleBaseUrl, org)
    const planName = PLAN_NAMES[planId]

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
        },
      }),
    })
    if (!txRes.ok) {
      const detail = await txRes.text()
      console.error('[paddle-checkout] subscription transaction create failed:', txRes.status, detail)
      return json({ error: 'Could not start checkout. Please try again.', detail }, 502)
    }
    const txBody = await txRes.json()
    const transactionId = txBody.data.id as string

    const { error: subTxErr } = await admin.from('subscription_transactions').insert({
      organization_id: organizationId,
      paddle_transaction_id: transactionId,
      plan_key: planId,
      billing_period: billingPeriod,
      amount: amountEur,
      amount_due: amountEur,
      currency: 'EUR',
      status: 'pending',
    })
    if (subTxErr) {
      console.error('[paddle-checkout] subscription_transactions insert failed:', subTxErr.message)
    }

    return json({ transactionId })
  } catch (err) {
    console.error('[paddle-checkout] unexpected:', err)
    return json({ error: err instanceof Error ? err.message : 'Checkout failed' }, 500)
  }
})
