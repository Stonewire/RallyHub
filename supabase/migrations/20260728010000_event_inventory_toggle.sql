-- Per-event switch for the Inventory "Buy Items" feature. Organisers who are not
-- running a physical item shop should not show players a button they cannot use.
-- Defaults to true, so every existing event keeps its current behaviour.
alter table public.events
  add column if not exists inventory_enabled boolean not null default true;

comment on column public.events.inventory_enabled is
  'When false, the participant Buy Items button is hidden and purchases are rejected.';

-- Re-declared verbatim from 20260716124826 with only the inventory_enabled check
-- added, so the private score-deduction marker and purchase insert stay intact.
create or replace function public.purchase_inventory_item(
  p_public_code uuid,
  p_event_id uuid,
  p_purchase_token text
)
returns table (
  purchase_id uuid,
  item_id uuid,
  team_id uuid,
  item_name text,
  points_cost integer,
  remaining_score integer
)
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_organization_id uuid;
  v_status text;
  v_inventory_enabled boolean;
  v_item public.inventory_items%rowtype;
  v_team public.teams%rowtype;
  v_purchase_id uuid;
  v_team_id uuid;
begin
  if not public.live_join_token_matches_event(p_event_id) then
    raise exception 'Event access has expired. Open your team page and scan again.';
  end if;

  select e.organization_id, e.status, e.inventory_enabled
  into v_organization_id, v_status, v_inventory_enabled
  from public.events e
  where e.id = p_event_id;

  if v_organization_id is null or v_status not in ('active', 'demo') then
    raise exception 'This event is not live.';
  end if;

  -- Hiding the button is not enough on its own: a player could still hold an
  -- item QR code from a previous event.
  if not coalesce(v_inventory_enabled, true) then
    raise exception 'Item purchases are switched off for this event.';
  end if;

  select i.*
  into v_item
  from public.inventory_items i
  where i.public_code = p_public_code
    and i.organization_id = v_organization_id
    and i.is_active;

  if v_item.id is null then
    raise exception 'This item is unavailable for your event.';
  end if;

  select a.team_id into v_team_id
  from public.inventory_team_access a
  where a.event_id = p_event_id
    and a.token_hash = digest(coalesce(p_purchase_token, ''), 'sha256');

  if v_team_id is null then
    raise exception 'This phone is not authorized to purchase for a team. Rejoin the event.';
  end if;

  select t.*
  into v_team
  from public.teams t
  where t.id = v_team_id
    and t.event_id = p_event_id
    and t.status = 'active'
    and nullif(trim(t.name), '') is not null
  for update;

  if v_team.id is null then
    raise exception 'Your team is not active in this event.';
  end if;

  if v_team.score < v_item.points_cost then
    raise exception 'Not enough points. This item costs % points and your team has %.',
      v_item.points_cost, v_team.score;
  end if;

  perform set_config('rallyhub.inventory_score_deduction', 'on', true);
  update public.teams
  set score = score - v_item.points_cost
  where id = v_team.id
  returning score into v_team.score;
  perform set_config('rallyhub.inventory_score_deduction', 'off', true);

  insert into public.inventory_purchases (
    inventory_item_id,
    organization_id,
    event_id,
    team_id,
    item_name,
    points_cost
  ) values (
    v_item.id,
    v_organization_id,
    p_event_id,
    v_team.id,
    v_item.name,
    v_item.points_cost
  )
  returning id into v_purchase_id;

  return query select
    v_purchase_id,
    v_item.id,
    v_team.id,
    v_item.name,
    v_item.points_cost,
    v_team.score;
end;
$$;
