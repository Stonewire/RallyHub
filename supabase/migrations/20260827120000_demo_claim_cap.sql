-- P4.1: demo events keep their full configured team list and every slot row.
-- The demo limitation is now ONLY that at most 2 teams may be CLAIMED at a
-- time. The join page and facilitator panel already guard this client-side;
-- this migration adds the server-side backstop inside the claim RPC.
--
-- P4 review additions:
--   1. Drop the old events_demo_team_count_check constraint (migration 030:
--      status <> 'demo' or team_count <= 2). Under P4.1 a demo event keeps
--      its full configured team list, so the old cap on team_count would
--      block moving any event with more than 2 teams into demo.
--   2. precheck_event_activation: lets the client ask the entitlement gate
--      BEFORE clearing demo data, so a refused activation never destroys it.

alter table public.events
  drop constraint if exists events_demo_team_count_check;

--
-- Copied from the current definition in 20260716104031_inventory_library.sql
-- (grants unchanged since 20260716123203 added authenticated; CREATE OR
-- REPLACE preserves existing privileges). Contract is identical: same
-- signature, same return table, same error messages for the existing checks.
-- The only addition is the demo claimed-teams cap.

create or replace function public.claim_team_with_inventory_access(
  p_event_id uuid,
  p_team_id uuid,
  p_name text,
  p_photo_url text default null
)
returns table (
  id uuid,
  event_id uuid,
  name text,
  color text,
  photo_url text,
  score integer,
  status text,
  slot_number integer,
  created_at timestamptz,
  inventory_purchase_token text
)
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_team public.teams%rowtype;
  v_token text;
  v_event_status text;
  v_claimed_count integer;
begin
  if not public.live_join_token_matches_event(p_event_id) then
    raise exception 'Event access has expired. Reload the team page.';
  end if;

  select e.status into v_event_status
  from public.events e
  where e.id = p_event_id;

  if v_event_status is null or v_event_status not in ('active', 'demo') then
    raise exception 'This event is not live.';
  end if;

  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) > 120 then
    raise exception 'Enter a valid team name.';
  end if;

  -- Demo cap: at most 2 claimed teams at a time. The event-row lock
  -- serialises concurrent demo claims so two devices cannot both pass the
  -- count check; it is taken BEFORE the team-row lock below to match
  -- reset_event_data's event-then-teams lock order and avoid deadlocks.
  if v_event_status = 'demo' then
    perform 1 from public.events e where e.id = p_event_id for update;

    select count(*) into v_claimed_count
    from public.teams t
    where t.event_id = p_event_id
      and t.id <> p_team_id
      and nullif(trim(t.name), '') is not null;

    if v_claimed_count >= 2 then
      raise exception 'Demo events allow up to 2 claimed teams.';
    end if;
  end if;

  select t.* into v_team
  from public.teams t
  where t.id = p_team_id and t.event_id = p_event_id
  for update;

  if v_team.id is null then
    raise exception 'Team not found.';
  end if;
  if nullif(trim(v_team.name), '') is not null then
    raise exception 'This team has already been claimed.';
  end if;

  update public.teams t
  set name = trim(p_name), photo_url = p_photo_url, status = 'active'
  where t.id = p_team_id
  returning t.* into v_team;

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.inventory_team_access (team_id, event_id, token_hash)
  values (v_team.id, p_event_id, digest(v_token, 'sha256'))
  on conflict (team_id) do update
    set event_id = excluded.event_id, token_hash = excluded.token_hash, created_at = now();

  return query select
    v_team.id, v_team.event_id, v_team.name, v_team.color, v_team.photo_url,
    v_team.score, v_team.status, v_team.slot_number, v_team.created_at, v_token;
end;
$$;

comment on function public.claim_team_with_inventory_access(uuid, uuid, text, text) is
  'Claims a team slot behind the live join token and mints the per-device purchase token. Demo events accept at most 2 claimed teams at a time.';

-- P4 review: the entitlement gate (assert_event_activation_allowed) only fires
-- inside the status update trigger, but the demo to active flow clears demo
-- data BEFORE flipping the status. Without a precheck, a refused activation
-- (ORG_SUSPENDED, SUBSCRIPTION_REQUIRED, UNPAID_INVOICE, EVENT_LIMIT_REACHED)
-- would still have destroyed the demo data and Storage files. This RPC calls
-- the gate exactly like trg_event_activation_billing does (two-arg call, so
-- p_enforce_payment keeps its default true) WITHOUT changing anything; the
-- client runs it first and aborts before any reset if it raises.
create or replace function public.precheck_event_activation(p_event_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select e.organization_id into v_org_id
  from public.events e
  where e.id = p_event_id;

  if v_org_id is null then
    raise exception 'Event not found';
  end if;

  -- Same authorization shape as reset_event_data: own org, or super admin.
  if v_org_id is distinct from public.user_organization_id()
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  then
    raise exception 'Not authorized to activate this event';
  end if;

  perform public.assert_event_activation_allowed(v_org_id, p_event_id);
end;
$$;

revoke execute on function public.precheck_event_activation(uuid) from public, anon;
grant execute on function public.precheck_event_activation(uuid) to authenticated;

comment on function public.precheck_event_activation(uuid) is
  'Runs the event activation entitlement gate without changing anything, so the client can refuse an activation BEFORE clearing demo data.';
