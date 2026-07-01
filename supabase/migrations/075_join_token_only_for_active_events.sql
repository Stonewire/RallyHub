-- P1-4: only issue a live join token for joinable events. Previously any event
-- UUID returned a token, exposing games for draft/archived/cancelled events.
-- Applied to production via the Supabase connector on 2026-07-01.
create or replace function public.bootstrap_live_event_access(p_event_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select e.join_token
  from public.events e
  where e.id = p_event_id
    and e.status in ('active', 'ready', 'demo')
  limit 1;
$$;
