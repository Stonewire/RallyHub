// Server-side password-reset request (audit 2026-08-11, finding AUD-4).
//
// Resolves a username to its account email server-side and triggers the reset
// email WITHOUT ever returning the email to the browser, then always responds
// with the same generic { ok: true }. This lets the forgot-password page stop
// calling the resolve_login_email anon RPC (which leaked the email), and gives
// away nothing about whether an account exists.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Always resolve to a generic success so nothing leaks about account existence.
  const ok = () => json({ ok: true })

  try {
    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    if (!url || !serviceKey || !anonKey) {
      console.error('[request-password-reset] missing env vars')
      return ok()
    }

    const { identifier, redirectTo } = await req.json().catch(() => ({}))
    if (typeof identifier !== 'string' || !identifier.trim()) return ok()
    const id = identifier.trim()

    // Resolve to an email. Never returned to the caller.
    let email: string | null = null
    if (id.includes('@')) {
      email = id.toLowerCase()
    } else {
      const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${serviceKey}` } },
      })
      const { data: rows } = await admin
        .from('profiles')
        .select('id')
        .eq('username', id.toLowerCase())
        .limit(1)
      const profileId = rows?.[0]?.id
      if (profileId) {
        const { data: userRes } = await admin.auth.admin.getUserById(profileId)
        email = userRes.user?.email ?? null
      }
    }

    if (email) {
      // Anon client sends the standard recovery email. GoTrue enforces its own
      // redirect-URL allowlist, so redirectTo cannot be used for open redirect.
      const authClient = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      })
      const opts = typeof redirectTo === 'string' && redirectTo ? { redirectTo } : undefined
      await authClient.auth.resetPasswordForEmail(email, opts)
      // Ignore the result deliberately: never signal success/failure per account.
    }

    return ok()
  } catch (err) {
    console.error('[request-password-reset] unexpected error:', err)
    return ok()
  }
})
