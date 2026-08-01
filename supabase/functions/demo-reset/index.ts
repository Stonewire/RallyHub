import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { requireAuthUser } from '../_shared/auth.ts'
import { cleanupDemoStorage, cleanupDemoUsers } from '../_shared/demo-cleanup.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { data: profile } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', auth.user.id)
      .single()
    if (!profile?.organization_id) return json({ error: 'Demo organization not found.' }, 404)

    const { data: org } = await admin
      .from('organizations')
      .select('id, is_demo, demo_reset_at, demo_user_id')
      .eq('id', profile.organization_id)
      .single()
    if (!org?.is_demo) return json({ error: 'This account is not a demo sandbox.' }, 403)

    const body = await req.json().catch(() => ({}))
    const force = body.action === 'reset' && body.force !== false
    const resetDue = !org.demo_reset_at || new Date(org.demo_reset_at).getTime() <= Date.now()
    if (force || resetDue) {
      await Promise.all([
        cleanupDemoStorage(admin, org.id),
        cleanupDemoUsers(admin, org.id, org.demo_user_id),
      ])
    }
    const { data, error } = await admin.rpc('reset_demo_sandbox', {
      p_organization_id: org.id,
      p_force: force,
    })
    if (error) throw error

    const state = Array.isArray(data) ? data[0] : data
    return json({
      organizationId: state.organization_id,
      lastResetAt: state.last_reset_at,
      nextResetAt: state.next_reset_at,
      resetIntervalMinutes: state.reset_interval_minutes,
      generation: state.generation,
    })
  } catch (error) {
    console.error('[demo-reset]', error)
    return json({ error: error instanceof Error ? error.message : 'Could not reset the demo.' }, 500)
  }
})
