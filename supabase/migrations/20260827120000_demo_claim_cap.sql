-- P4.1: demo events keep their full configured team list and every slot row.
-- The demo limitation is now ONLY that at most 2 teams may be CLAIMED at a
-- time. The join page and facilitator panel already guard this client-side;
-- this migration adds the server-side backstop inside the claim RPC.
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
