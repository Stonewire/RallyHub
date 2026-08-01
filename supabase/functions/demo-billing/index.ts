import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { requireAuthUser, requireOrgAdminOrSuperAdmin } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const prices: Record<string, { monthly: number; yearly: number }> = {
  rookie: { monthly: 0, yearly: 0 },
  arena: { monthly: 20, yearly: 180 },
  pro: { monthly: 200, yearly: 1800 },
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server misconfiguration' }, 500)

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
    })
    const auth = await requireAuthUser(admin, req.headers.get('Authorization'))
    if (!auth.ok) return json({ error: auth.message }, auth.status)

    const body = await req.json()
    const organizationId = typeof body.organizationId === 'string' ? body.organizationId : ''
    if (!organizationId) return json({ error: 'organizationId is required' }, 400)

    const access = await requireOrgAdminOrSuperAdmin(admin, auth.user.id, organizationId)
    if (!access.ok) return json({ error: access.message }, access.status)

    const { data: org } = await admin
      .from('organizations')
      .select('id, is_demo, billing_plan, billing_period')
      .eq('id', organizationId)
      .single()
    if (!org?.is_demo) return json({ error: 'Demo billing is unavailable for this account.' }, 403)

    const kind = body.kind
    if (kind === 'event') {
      const { data: invoice } = await admin
        .from('invoices')
        .select('id, status')
        .eq('id', body.invoiceId)
        .eq('organization_id', organizationId)
        .single()
      if (!invoice || invoice.status !== 'unpaid') return json({ error: 'Unpaid invoice not found.' }, 404)
      return json({ transactionId: `demo_event_${crypto.randomUUID()}` })
    }

    if (kind === 'event_complete') {
      if (typeof body.transactionId !== 'string' || !body.transactionId.startsWith('demo_event_')) {
        return json({ error: 'Invalid demo transaction.' }, 400)
      }
      const { data: invoice, error } = await admin
        .from('invoices')
        .update({ status: 'paid', paddle_transaction_id: body.transactionId })
        .eq('id', body.invoiceId)
        .eq('organization_id', organizationId)
        .select('event_id')
        .single()
      if (error || !invoice) return json({ error: 'Invoice not found.' }, 404)
      await admin.from('events').update({ invoice_paid: true }).eq('id', invoice.event_id)
      return json({ completed: true })
    }

    const planId = typeof body.planId === 'string' ? body.planId : ''
    const billingPeriod = body.billingPeriod === 'monthly' ? 'monthly' : 'yearly'
    if (!prices[planId]) return json({ error: 'Choose a valid demo plan.' }, 400)
    const amount = prices[planId][billingPeriod]

    if (kind === 'subscription') {
      return json({ transactionId: `demo_subscription_${crypto.randomUUID()}` })
    }

    if (kind === 'subscription_change_preview') {
      const currentPlan = prices[org.billing_plan] ?? prices.rookie
      const currentPeriod = org.billing_period === 'monthly' ? 'monthly' : 'yearly'
      const currentAmount = currentPlan[currentPeriod]
      return json({
        planId,
        billingPeriod,
        dueNow: Math.max(amount - currentAmount, 0),
        creditToBalance: Math.max(currentAmount - amount, 0),
        recurringTotal: amount,
        currency: 'EUR',
        nextBilledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
    }

    if (kind === 'subscription_complete' || kind === 'subscription_change') {
      const transactionId = kind === 'subscription_complete'
        ? body.transactionId
        : `demo_plan_change_${crypto.randomUUID()}`
      if (typeof transactionId !== 'string' || !transactionId.startsWith('demo_')) {
        return json({ error: 'Invalid demo transaction.' }, 400)
      }

      const free = planId === 'rookie'
      const update = await admin.from('organizations').update({
        billing_plan: planId,
        billing_period: billingPeriod,
        paddle_subscription_id: free ? null : 'demo_subscription_active',
        subscription_status: free ? 'canceled' : 'active',
        subscription_current_period_end: free
          ? null
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }).eq('id', organizationId)
      if (update.error) throw update.error

      const transaction = await admin.from('subscription_transactions').insert({
        organization_id: organizationId,
        paddle_transaction_id: transactionId,
        paddle_subscription_id: free ? null : 'demo_subscription_active',
        plan_key: planId,
        billing_period: billingPeriod,
        amount,
        amount_due: amount,
        currency: 'EUR',
        status: 'paid',
      })
      if (transaction.error) throw transaction.error

      return json({ changed: true, planId, billingPeriod })
    }

    return json({ error: 'Unsupported demo billing action.' }, 400)
  } catch (error) {
    console.error('[demo-billing]', error)
    return json({ error: error instanceof Error ? error.message : 'Demo billing failed.' }, 500)
  }
})
