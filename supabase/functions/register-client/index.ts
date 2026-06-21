// Public self-serve signup: creates an organization + its first client_admin
// user. Unlike create-client (super-admin only), this is unauthenticated — it is
// the endpoint behind the marketing "Start for free" / registration form.
//
// Hardening TODO before public launch: add a captcha/Turnstile token check and
// rate limiting, and consider real email verification (email_confirm: false +
// SMTP) instead of the auto-confirm used here.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Internal plan ids the form may submit (display names: Free/Starter/Pro/Max).
const ALLOWED_PLANS = new Set(['rookie', 'arena', 'pro', 'max'])

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'org'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[register-client] missing env vars — url:', !!supabaseUrl, 'srk:', !!serviceRoleKey)
      return json({ error: 'Server misconfiguration' }, 500)
    }

    // Deno-safe client options: disable browser-only APIs (localStorage, setInterval)
    // that supabase-js tries to use and which corrupt the GoTrue admin client in edge runtimes.
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
    })

    const { orgName, fullName, email, password, plan, isSchool } = await req.json()

    if (!orgName?.trim() || !email?.trim() || !password) {
      return json({ error: 'Organization name, email and password are required.' }, 400)
    }
    if (typeof password !== 'string' || password.length < 8) {
      return json({ error: 'Password must be at least 8 characters.' }, 400)
    }

    const planId = ALLOWED_PLANS.has(plan) ? plan : 'rookie'
    const emailTrimmed = email.trim().toLowerCase()
    let usernameBase = emailTrimmed.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (usernameBase.length < 3) usernameBase = 'admin'

    // Unique subdomain.
    let sub = slugify(orgName)
    const { data: existing } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('subdomain', sub)
      .maybeSingle()
    if (existing) {
      sub = `${sub}-${Date.now().toString(36).slice(-4)}`
    }

    // Paid plans get a 1-month free trial (no subscription charge during it;
    // per-event fees still apply). The Free plan has no subscription at all.
    const isPaid = planId !== 'rookie'
    const trialEndsAt = isPaid
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null

    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: orgName.trim(),
        email: emailTrimmed,
        contact_email: emailTrimmed,
        subdomain: sub,
        billing_plan: planId,
        billing_period: 'yearly',
        trial_ends_at: trialEndsAt,
        educational_status: isSchool ? 'pending' : 'none',
      })
      .select()
      .single()

    if (orgErr) {
      console.error('[register-client] org insert:', orgErr.message, orgErr.details)
      return json({ error: orgErr.message }, 400)
    }

    const { error: seedErr } = await supabaseAdmin.rpc('seed_organization_defaults', { p_org_id: org.id })
    if (seedErr) console.error('[register-client] seed_organization_defaults:', seedErr.message)

    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: emailTrimmed,
      password,
      email_confirm: true,
      user_metadata: {
        username: usernameBase,
        full_name: (fullName ?? orgName).trim(),
        role: 'client_admin',
        organization_id: org.id,
      },
    })

    if (authErr) {
      console.error('[register-client] auth.admin.createUser:', JSON.stringify(authErr))
      // Roll back the org so a retry with a free email can succeed.
      await supabaseAdmin.from('organizations').delete().eq('id', org.id)
      const dup = /already (been )?registered|exists/i.test(authErr.message)
      return json(
        { error: dup ? 'An account with this email already exists. Try signing in instead.' : authErr.message },
        400,
      )
    }

    if (authUser.user) {
      await supabaseAdmin
        .from('profiles')
        .update({
          organization_id: org.id,
          role: 'client_admin',
          username: usernameBase,
          full_name: (fullName ?? orgName).trim(),
        })
        .eq('id', authUser.user.id)
    }

    return json({
      org: { id: org.id, subdomain: org.subdomain, name: org.name },
      userId: authUser.user?.id,
    })
  } catch (err) {
    console.error('[register-client] unexpected error:', err)
    return json({ error: err instanceof Error ? err.message : 'Registration failed' }, 500)
  }
})
