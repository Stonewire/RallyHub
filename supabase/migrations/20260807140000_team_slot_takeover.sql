-- CF2-8: a team that lost its device can move to a new one. The new device
-- taps the taken slot and enters the organisation's TABLET password (Rumen's
-- decision, 7 Aug 2026); the takeover bumps the team's session_epoch, which
-- every claimed device watches - a device holding an older epoch logs itself
-- out. The inventory purchase token is rotated so the old device also loses
-- buying power immediately.
--
-- Applied to production 7 Aug 2026 via MCP apply_migration.

alter table public.teams add column if not exists session_epoch integer not null default 0;

create or replace function public.takeover_team_slot(
  p_event_id uuid,
  p_team_id uuid,
  p_password text
)
returns table(
  id uuid, event_id uuid, name text, color text, photo_url text,
  score integer, status text, slot_number integer, created_at timestamptz,
  session_epoch integer, inventory_purchase_token text
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_team public.teams%rowtype;
  v_token text;
  v_pw text;
begin
  if not public.live_join_token_matches_event(p_event_id) then
    raise exception 'Event access has expired. Reload the team page.';
  end if;

  select o.tablet_password into v_pw
  from public.events e
  join public.organizations o on o.id = e.organization_id
  where e.id = p_event_id and e.status in ('active', 'demo');
  if not found then
    raise exception 'This event is not live.';
  end if;
  if v_pw is null or btrim(v_pw) = '' then
    raise exception 'Device switching is not set up for this event. Ask your facilitator.';
  end if;
  if btrim(coalesce(p_password, '')) is distinct from btrim(v_pw) then
    raise exception 'Wrong password. Ask your facilitator for the event password.';
  end if;

  select t.* into v_team
  from public.teams t
  where t.id = p_team_id and t.event_id = p_event_id
  for update;
  if v_team.id is null then
    raise exception 'Team not found.';
  end if;
  if nullif(btrim(v_team.name), '') is null then
    raise exception 'This team is still free - join it normally.';
  end if;

  update public.teams t
  set session_epoch = t.session_epoch + 1
  where t.id = p_team_id
  returning t.* into v_team;

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.inventory_team_access (team_id, event_id, token_hash)
  values (v_team.id, p_event_id, digest(v_token, 'sha256'))
  on conflict (team_id) do update
    set event_id = excluded.event_id, token_hash = excluded.token_hash, created_at = now();

  return query select
    v_team.id, v_team.event_id, v_team.name, v_team.color, v_team.photo_url,
    v_team.score, v_team.status, v_team.slot_number, v_team.created_at,
    v_team.session_epoch, v_token;
end;
$$;

grant execute on function public.takeover_team_slot(uuid, uuid, text) to anon, authenticated;
