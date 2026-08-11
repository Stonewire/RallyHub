// Public self-serve signup: creates an organization + its first client_admin
// user. Unlike create-client (super-admin only), this is unauthenticated — it is
// the endpoint behind the marketing "Start for free" / registration form.
//
// Hardening TODO before public launch: consider real email verification
// (email_confirm: false + SMTP) instead of the auto-confirm used here.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// P2-5: per-IP rate limit. Generous enough for a real user retrying a
// typo'd field a few times, tight enough to stop a scripted loop.
const RATE_LIMIT_MAX_ATTEMPTS = 5
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

// P2-5b: Turnstile verification. FAIL CLOSED (audit 2026-08-11, finding 6):
// the bot check is mandatory. If TURNSTILE_SECRET_KEY is not set the endpoint
// refuses signups rather than silently letting a scripted loop create fake
// orgs/accounts. The secret is configured in production.
const TURNSTILE_SECRET_KEY = Deno.env.get('TURNSTILE_SECRET_KEY')

async function verifyTurnstileToken(token: unknown, remoteIp: string): Promise<boolean> {
  if (typeof token !== 'string' || !token) return false
  const body = new URLSearchParams({ secret: TURNSTILE_SECRET_KEY!, response: token })
  if (remoteIp !== 'unknown') body.set('remoteip', remoteIp)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json()
  return data.success === true
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-join-token',
}

// Internal plan ids the form may submit (Pay Per Event/Starter/Pro).
// Custom (contact-sales only, price on request) is deliberately excluded —
// it is only ever assigned by a super admin, never chosen at self-serve signup.
const ALLOWED_PLANS = new Set(['rookie', 'arena', 'pro'])

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

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { count: recentAttempts } = await supabaseAdmin
      .from('signup_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .gt('created_at', new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString())
    if ((recentAttempts ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
      return json({ error: 'Too many signup attempts. Please try again in a while.' }, 429)
    }
    await supabaseAdmin.from('signup_attempts').insert({ ip_address: ip })

    const { orgName, fullName, email, password, plan, isSchool, turnstileToken } = await req.json()

    if (!orgName?.trim() || !email?.trim() || !password) {
      return json({ error: 'Organization name, email and password are required.' }, 400)
    }

    if (!TURNSTILE_SECRET_KEY) {
      console.error('[register-client] TURNSTILE_SECRET_KEY not set — refusing signup (fail closed)')
      return json({ error: 'Server misconfiguration' }, 500)
    }
    const verified = await verifyTurnstileToken(turnstileToken, ip)
    if (!verified) {
      return json({ error: 'Verification failed. Please try again.' }, 400)
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

    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: orgName.trim(),
        email: emailTrimmed,
        contact_email: emailTrimmed,
        subdomain: sub,
        billing_plan: planId,
        billing_period: 'yearly',
        trial_ends_at: null,
        account_status: 'active',
        educational_status: isSchool ? 'pending' : 'none',
      })
      .select()
      .single()

    if (orgErr) {
      console.error('[register-client] org insert:', orgErr.message, orgErr.details)
      return json({ error: orgErr.message }, 400)
    }

    // #12: new clients start bare-bones — no default/demo content is seeded.

    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: emailTrimmed,
      password,
      email_confirm: true,
      user_metadata: {
        username: usernameBase,
        full_name: (fullName ?? orgName).trim(),
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
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .update({
          organization_id: org.id,
          role: 'client_admin',
          username: usernameBase,
          full_name: (fullName ?? orgName).trim(),
        })
        .eq('id', authUser.user.id)
        .select('id')
        .single()

      if (profileErr) {
        console.error('[register-client] profile update:', profileErr.message, profileErr.details)
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
        await supabaseAdmin.from('organizations').delete().eq('id', org.id)
        return json({ error: 'Could not finish account setup. Please try again.' }, 500)
      }
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
