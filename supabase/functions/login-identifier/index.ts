// Server-side username/email login (audit 2026-08-11, finding AUD-4).
//
// Resolves a username to its account email WITHOUT ever returning the email to
// the browser, then signs in and returns only the session tokens. This closes
// the resolve_login_email anon RPC, which handed the real email behind any
// username to any unauthenticated caller (a username-enumeration + PII oracle).
//
// Unknown username and wrong password both return the SAME generic 401, so the
// endpoint gives away nothing about which usernames exist.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-join-token',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const INVALID = 'Invalid username/email or password.'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    if (!url || !serviceKey || !anonKey) {
      console.error('[login-identifier] missing env vars')
      return json({ error: 'Server misconfiguration' }, 500)
    }

    const { identifier, password } = await req.json().catch(() => ({}))
    if (
      typeof identifier !== 'string' ||
      typeof password !== 'string' ||
      !identifier.trim() ||
      !password
    ) {
      return json({ error: INVALID }, 401)
    }
    const id = identifier.trim()

    // Resolve the login identifier to an email. Never returned to the caller.
    let email: string | null = null
    if (id.includes('@')) {
      email = id.toLowerCase()
    } else {
      const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${serviceKey}` } },
      })
      // Usernames are stored lowercased. Exact match (NOT ilike) so a '%' in the
      // identifier can never wildcard-match another account.
      const { data: rows, error: lookupErr } = await admin
        .from('profiles')
        .select('id')
        .eq('username', id.toLowerCase())
        .limit(1)
      if (lookupErr) {
        console.error('[login-identifier] profile lookup failed:', lookupErr.message)
        return json({ error: INVALID }, 401)
      }
      const profileId = rows?.[0]?.id
      if (profileId) {
        const { data: userRes } = await admin.auth.admin.getUserById(profileId)
        email = userRes.user?.email ?? null
      }
    }
    if (!email) return json({ error: INVALID }, 401)

    // Sign in through a clean anon client (the normal GoTrue password flow).
    const authClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
    const { data: signIn, error: signErr } = await authClient.auth.signInWithPassword({
      email,
      password,
    })
    if (signErr || !signIn.session) {
      return json({ error: INVALID }, 401)
    }

    const s = signIn.session
    return json({
      session: {
        access_token: s.access_token,
        refresh_token: s.refresh_token,
        expires_in: s.expires_in,
        expires_at: s.expires_at,
        token_type: s.token_type,
      },
    })
  } catch (err) {
    console.error('[login-identifier] unexpected error:', err)
    return json({ error: 'Login failed' }, 500)
  }
})
