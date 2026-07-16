-- Reusable physical inventory that teams can buy with event points.
-- Prices are authoritative in Postgres; participant clients never submit a
-- price or write a score directly.

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  public_code uuid not null default gen_random_uuid() unique,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  points_cost integer not null check (points_cost > 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_purchases (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid references public.inventory_items (id) on delete set null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  item_name text not null,
  points_cost integer not null check (points_cost > 0),
  created_at timestamptz not null default now()
);

-- Kept separate from teams because participant team rows are readable inside a
-- live event. Only a SHA-256 hash is stored; the raw token stays on the device.
create table public.inventory_team_access (
  team_id uuid primary key references public.teams (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now()
);

create index inventory_items_organization_id_idx
  on public.inventory_items (organization_id, created_at desc);
create index inventory_purchases_inventory_item_id_idx
  on public.inventory_purchases (inventory_item_id);
create index inventory_purchases_organization_created_at_idx
  on public.inventory_purchases (organization_id, created_at desc);
create index inventory_purchases_event_team_created_at_idx
  on public.inventory_purchases (event_id, team_id, created_at desc);
create index inventory_team_access_event_id_idx
  on public.inventory_team_access (event_id);

create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

alter table public.inventory_items enable row level security;
alter table public.inventory_purchases enable row level security;
alter table public.inventory_team_access enable row level security;

create policy "inventory_items_org_select"
on public.inventory_items for select to authenticated
using (
  organization_id = (select public.user_organization_id())
  or (select public.is_super_admin())
);

create policy "inventory_items_org_insert"
on public.inventory_items for insert to authenticated
with check (
  organization_id = (select public.user_organization_id())
  or (select public.is_super_admin())
);

create policy "inventory_items_org_update"
on public.inventory_items for update to authenticated
using (
  organization_id = (select public.user_organization_id())
  or (select public.is_super_admin())
)
with check (
  organization_id = (select public.user_organization_id())
  or (select public.is_super_admin())
);

create policy "inventory_items_org_delete"
on public.inventory_items for delete to authenticated
using (
  organization_id = (select public.user_organization_id())
  or (select public.is_super_admin())
);

create policy "inventory_purchases_org_select"
on public.inventory_purchases for select to authenticated
using (
  organization_id = (select public.user_organization_id())
  or (select public.is_super_admin())
);

-- Supabase projects created after April 2026 may not expose new public tables
-- automatically, so opt in with the narrowest privileges the app needs.
revoke all on public.inventory_items from anon, authenticated;
revoke all on public.inventory_purchases from anon, authenticated;
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select on public.inventory_purchases to authenticated;

-- Team claiming now goes through the function below, which can mint the private
-- per-device purchase credential atomically. Direct anonymous team updates are
-- no longer needed.
drop policy if exists "teams_anon_update_claim" on public.teams;

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
begin
  if not public.live_join_token_matches_event(p_event_id) then
    raise exception 'Event access has expired. Reload the team page.';
  end if;
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.status in ('active', 'demo')
  ) then
    raise exception 'This event is not live.';
  end if;
  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) > 120 then
    raise exception 'Enter a valid team name.';
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

create or replace function public.get_inventory_item_for_purchase(
  p_public_code uuid,
  p_event_id uuid
)
returns table (
  id uuid,
  name text,
  description text,
  points_cost integer,
  image_url text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_status text;
begin
  if not public.live_join_token_matches_event(p_event_id) then
    raise exception 'Event access has expired. Open your team page and scan again.';
  end if;

  select e.organization_id, e.status
  into v_organization_id, v_status
  from public.events e
  where e.id = p_event_id;

  if v_organization_id is null or v_status not in ('active', 'demo') then
    raise exception 'This event is not live.';
  end if;

  return query
  select i.id, i.name, i.description, i.points_cost, i.image_url
  from public.inventory_items i
  where i.public_code = p_public_code
    and i.organization_id = v_organization_id
    and i.is_active;
end;
$$;

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
  v_item public.inventory_items%rowtype;
  v_team public.teams%rowtype;
  v_purchase_id uuid;
  v_team_id uuid;
begin
  if not public.live_join_token_matches_event(p_event_id) then
    raise exception 'Event access has expired. Open your team page and scan again.';
  end if;

  select e.organization_id, e.status
  into v_organization_id, v_status
  from public.events e
  where e.id = p_event_id;

  if v_organization_id is null or v_status not in ('active', 'demo') then
    raise exception 'This event is not live.';
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

  -- The row lock makes the balance check and deduction atomic. Two simultaneous
  -- scans cannot both spend the same points.
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

  update public.teams
  set score = score - v_item.points_cost
  where id = v_team.id
  returning score into v_team.score;

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

revoke all on function public.get_inventory_item_for_purchase(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.claim_team_with_inventory_access(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.purchase_inventory_item(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_inventory_item_for_purchase(uuid, uuid)
  to anon, service_role;
grant execute on function public.claim_team_with_inventory_access(uuid, uuid, text, text)
  to anon, service_role;
grant execute on function public.purchase_inventory_item(uuid, uuid, text)
  to anon, service_role;

comment on table public.inventory_items is
  'Reusable organization inventory with stable QR codes and point prices.';
comment on table public.inventory_purchases is
  'Immutable audit log of physical inventory purchases and point deductions.';
comment on function public.purchase_inventory_item(uuid, uuid, text) is
  'Atomically verifies participant event/team access, checks balance, deducts points, and records one purchase.';
