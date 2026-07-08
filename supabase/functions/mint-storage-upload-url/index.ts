// P0-2b: storage-api does not forward the x-join-token header the way
// PostgREST does (confirmed by 076 -> 079: requiring the token in storage RLS
// broke anon uploads mid-event). This edge function is the workaround —
// verify the join token here (a normal request, headers ARE visible),
// then mint a short-lived signed upload URL scoped to exactly one path.
// The client uploads directly to that URL; it bypasses bucket RLS entirely
// (Supabase's own signed-upload mechanism), so the destination path is the
// only thing that has to be trustworthy — hence the strict shape check below.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-join-token',
}

// {eventId}/(teams|submissions)/{entityId}/{filename} — the only shapes the
// two participant upload call sites (quest submissions, team claim photo) use.
const ALLOWED_PATH_RE =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\/(teams|submissions)\/[^/]+\/[^/]+$/

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
      console.error('[mint-storage-upload-url] missing env vars')
      return json({ error: 'Server misconfiguration' }, 500)
    }

    const { eventId, path } = await req.json()
    if (!eventId || typeof eventId !== 'string' || !path || typeof path !== 'string') {
      return json({ error: 'eventId and path are required' }, 400)
    }

    const match = ALLOWED_PATH_RE.exec(path)
    if (!match || match[1].toLowerCase() !== eventId.toLowerCase()) {
      return json({ error: 'Path not allowed' }, 400)
    }

    const joinToken = req.headers.get('x-join-token')?.trim()
    if (!joinToken) {
      return json({ error: 'Missing join token' }, 401)
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })

    const { data: event, error: eventErr } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('join_token', joinToken)
      .maybeSingle()

    if (eventErr) throw eventErr
    if (!event) {
      return json({ error: 'Invalid join token for this event' }, 403)
    }

    const { data, error } = await supabaseAdmin.storage
      .from('game-assets')
      .createSignedUploadUrl(path, { upsert: true })

    if (error || !data) {
      console.error('[mint-storage-upload-url] createSignedUploadUrl:', error?.message)
      return json({ error: error?.message ?? 'Could not create upload URL' }, 500)
    }

    return json({ signedUrl: data.signedUrl, token: data.token, path: data.path })
  } catch (err) {
    console.error('[mint-storage-upload-url] unexpected error:', err)
    return json({ error: err instanceof Error ? err.message : 'Upload authorization failed' }, 500)
  }
})
