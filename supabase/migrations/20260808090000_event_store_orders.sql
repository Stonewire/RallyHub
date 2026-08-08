-- Event Store, part two: teams order from the store, the facilitator hands
-- items over and completes the order, and only completion deducts points.
-- Pending orders RESERVE stock; cancelling releases it.
--
-- Applied to production 8 Aug 2026 via MCP apply_migration and smoke-tested
-- in rollback transactions: browse -> order(2) -> reservation visible ->
-- complete -> points deducted; oversell (stock 1, qty 2) raises "sold out".

create table if not exists public.inventory_orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','done','cancelled')),
  total_points integer not null check (total_points >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.inventory_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.inventory_orders(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  quantity integer not null check (quantity > 0),
  points_cost_each integer not null check (points_cost_each >= 0),
  fulfilled boolean not null default false
);

create index if not exists inventory_orders_event_idx on public.inventory_orders(event_id, status);
create index if not exists inventory_order_items_order_idx on public.inventory_order_items(order_id);

alter table public.inventory_orders enable row level security;
alter table public.inventory_order_items enable row level security;

create policy inventory_orders_org_select on public.inventory_orders
  for select to authenticated
  using (organization_id = public.user_organization_id() or public.is_super_admin());
create policy inventory_order_items_org_select on public.inventory_order_items
  for select to authenticated
  using (exists (
    select 1 from public.inventory_orders o
    where o.id = order_id
      and (o.organization_id = public.user_organization_id() or public.is_super_admin())
  ));

create or replace function public.get_event_store(p_event_id uuid, p_purchase_token text)
returns table(
  item_id uuid, name text, description text, image_url text, points_cost integer,
  total_stock integer, per_team_limit integer, sold integer, my_team_qty integer,
  team_score integer
)
language plpgsql security definer set search_path to 'public', 'extensions'
as $$
declare
  v_team_id uuid;
  v_score integer;
begin
  if not public.live_join_token_matches_event(p_event_id) then
    raise exception 'Event access has expired. Reload the team page.';
  end if;

  select a.team_id into v_team_id
  from public.inventory_team_access a
  where a.event_id = p_event_id
    and a.token_hash = digest(coalesce(p_purchase_token, ''), 'sha256');
  if v_team_id is null then
    raise exception 'This phone is not authorized to buy for a team. Rejoin the event.';
  end if;

  select t.score into v_score from public.teams t where t.id = v_team_id;

  return query
  select
    i.id, i.name, i.description, i.image_url, i.points_cost,
    (cfg->>'totalStock')::int,
    greatest(1, (cfg->>'perTeamLimit')::int),
    coalesce((
      select sum(oi.quantity)::int
      from public.inventory_order_items oi
      join public.inventory_orders o on o.id = oi.order_id
      where o.event_id = p_event_id and o.status <> 'cancelled'
        and oi.inventory_item_id = i.id
    ), 0),
    coalesce((
      select sum(oi.quantity)::int
      from public.inventory_order_items oi
      join public.inventory_orders o on o.id = oi.order_id
      where o.event_id = p_event_id and o.status <> 'cancelled'
        and o.team_id = v_team_id and oi.inventory_item_id = i.id
    ), 0),
    v_score
  from public.events e
  cross join lateral jsonb_array_elements(coalesce(e.store_config, '[]'::jsonb)) cfg
  join public.inventory_items i
    on i.id = (cfg->>'itemId')::uuid and i.is_active
  where e.id = p_event_id and e.status in ('active','demo')
    and coalesce(e.inventory_enabled, true);
end;
$$;

create or replace function public.place_store_order(
  p_event_id uuid, p_purchase_token text, p_items jsonb
)
returns table(order_id uuid, total_points integer)
language plpgsql security definer set search_path to 'public', 'extensions'
as $$
declare
  v_team public.teams%rowtype;
  v_team_id uuid;
  v_org uuid;
  v_store jsonb;
  v_entry jsonb;
  v_item public.inventory_items%rowtype;
  v_cfg jsonb;
  v_qty integer;
  v_already integer;
  v_sold integer;
  v_total integer := 0;
  v_order_id uuid;
begin
  if not public.live_join_token_matches_event(p_event_id) then
    raise exception 'Event access has expired. Reload the team page.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your basket is empty.';
  end if;

  -- Lock the event row so two teams checking the same stock queue up.
  select e.organization_id, e.store_config into v_org, v_store
  from public.events e
  where e.id = p_event_id and e.status in ('active','demo')
    and coalesce(e.inventory_enabled, true)
  for update;
  if v_org is null then
    raise exception 'This event is not live.';
  end if;

  select a.team_id into v_team_id
  from public.inventory_team_access a
  where a.event_id = p_event_id
    and a.token_hash = digest(coalesce(p_purchase_token, ''), 'sha256');
  if v_team_id is null then
    raise exception 'This phone is not authorized to buy for a team. Rejoin the event.';
  end if;

  select t.* into v_team from public.teams t
  where t.id = v_team_id and t.event_id = p_event_id and t.status = 'active';
  if v_team.id is null then
    raise exception 'Your team is not active in this event.';
  end if;

  insert into public.inventory_orders (event_id, team_id, organization_id, status, total_points)
  values (p_event_id, v_team_id, v_org, 'pending', 0)
  returning id into v_order_id;

  for v_entry in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_entry->>'quantity')::int, 0);
    if v_qty < 1 then
      raise exception 'Invalid quantity.';
    end if;

    select cfg into v_cfg
    from jsonb_array_elements(coalesce(v_store, '[]'::jsonb)) cfg
    where cfg->>'itemId' = v_entry->>'itemId';
    if v_cfg is null then
      raise exception 'An item in your basket is not in this event''s store.';
    end if;

    select i.* into v_item from public.inventory_items i
    where i.id = (v_entry->>'itemId')::uuid and i.organization_id = v_org and i.is_active;
    if v_item.id is null then
      raise exception 'An item in your basket is no longer available.';
    end if;

    select coalesce(sum(oi.quantity), 0)::int into v_sold
    from public.inventory_order_items oi
    join public.inventory_orders o on o.id = oi.order_id
    where o.event_id = p_event_id and o.status <> 'cancelled'
      and oi.inventory_item_id = v_item.id and o.id <> v_order_id;
    if v_sold + v_qty > (v_cfg->>'totalStock')::int then
      raise exception '"%" is sold out — only % left.',
        v_item.name, greatest(0, (v_cfg->>'totalStock')::int - v_sold);
    end if;

    select coalesce(sum(oi.quantity), 0)::int into v_already
    from public.inventory_order_items oi
    join public.inventory_orders o on o.id = oi.order_id
    where o.event_id = p_event_id and o.status <> 'cancelled'
      and o.team_id = v_team_id and oi.inventory_item_id = v_item.id and o.id <> v_order_id;
    if v_already + v_qty > greatest(1, (v_cfg->>'perTeamLimit')::int) then
      raise exception 'Your team can take at most % of "%".',
        greatest(1, (v_cfg->>'perTeamLimit')::int), v_item.name;
    end if;

    insert into public.inventory_order_items
      (order_id, inventory_item_id, item_name, quantity, points_cost_each)
    values (v_order_id, v_item.id, v_item.name, v_qty, v_item.points_cost);
    v_total := v_total + v_qty * v_item.points_cost;
  end loop;

  if v_team.score < v_total then
    raise exception 'Not enough points. This order costs % and your team has %.',
      v_total, v_team.score;
  end if;

  update public.inventory_orders set total_points = v_total where id = v_order_id;
  return query select v_order_id, v_total;
end;
$$;

create or replace function public.get_team_store_orders(p_event_id uuid, p_purchase_token text)
returns table(
  order_id uuid, status text, total_points integer, created_at timestamptz,
  item_name text, quantity integer, fulfilled boolean
)
language plpgsql security definer set search_path to 'public', 'extensions'
as $$
declare
  v_team_id uuid;
begin
  if not public.live_join_token_matches_event(p_event_id) then
    raise exception 'Event access has expired. Reload the team page.';
  end if;
  select a.team_id into v_team_id
  from public.inventory_team_access a
  where a.event_id = p_event_id
    and a.token_hash = digest(coalesce(p_purchase_token, ''), 'sha256');
  if v_team_id is null then
    raise exception 'This phone is not authorized for a team. Rejoin the event.';
  end if;

  return query
  select o.id, o.status, o.total_points, o.created_at, oi.item_name, oi.quantity, oi.fulfilled
  from public.inventory_orders o
  join public.inventory_order_items oi on oi.order_id = o.id
  where o.event_id = p_event_id and o.team_id = v_team_id
  order by o.created_at desc, oi.item_name;
end;
$$;

create or replace function public.assert_can_fulfil_order(p_order_id uuid)
returns public.inventory_orders
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_order public.inventory_orders%rowtype;
begin
  select o.* into v_order from public.inventory_orders o where o.id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Order not found.';
  end if;
  if not (v_order.organization_id = public.user_organization_id() or public.is_super_admin()) then
    raise exception 'You do not have permission to manage this order.';
  end if;
  return v_order;
end;
$$;

create or replace function public.fulfil_store_order_item(p_order_item_id uuid, p_fulfilled boolean)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_order public.inventory_orders%rowtype;
  v_order_id uuid;
begin
  select oi.order_id into v_order_id from public.inventory_order_items oi where oi.id = p_order_item_id;
  if v_order_id is null then
    raise exception 'Order item not found.';
  end if;
  v_order := public.assert_can_fulfil_order(v_order_id);
  if v_order.status <> 'pending' then
    raise exception 'Only pending orders can be changed.';
  end if;
  update public.inventory_order_items set fulfilled = p_fulfilled where id = p_order_item_id;
end;
$$;

create or replace function public.complete_store_order(p_order_id uuid)
returns table(team_id uuid, remaining_score integer)
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_order public.inventory_orders%rowtype;
  v_team public.teams%rowtype;
begin
  v_order := public.assert_can_fulfil_order(p_order_id);
  if v_order.status <> 'pending' then
    raise exception 'This order is already %.', v_order.status;
  end if;

  select t.* into v_team from public.teams t where t.id = v_order.team_id for update;
  if v_team.score < v_order.total_points then
    raise exception 'The team has % points but this order costs %. Cancel it or adjust their score first.',
      v_team.score, v_order.total_points;
  end if;

  perform set_config('rallyhub.inventory_score_deduction', 'on', true);
  update public.teams set score = score - v_order.total_points
  where id = v_team.id returning score into v_team.score;
  perform set_config('rallyhub.inventory_score_deduction', 'off', true);

  update public.inventory_order_items set fulfilled = true where order_id = p_order_id;
  update public.inventory_orders
  set status = 'done', completed_at = now()
  where id = p_order_id;

  return query select v_team.id, v_team.score;
end;
$$;

create or replace function public.cancel_store_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_order public.inventory_orders%rowtype;
begin
  v_order := public.assert_can_fulfil_order(p_order_id);
  if v_order.status <> 'pending' then
    raise exception 'This order is already %.', v_order.status;
  end if;
  update public.inventory_orders set status = 'cancelled' where id = p_order_id;
end;
$$;

grant execute on function public.get_event_store(uuid, text) to anon, authenticated;
grant execute on function public.place_store_order(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.get_team_store_orders(uuid, text) to anon, authenticated;
grant execute on function public.fulfil_store_order_item(uuid, boolean) to authenticated;
grant execute on function public.complete_store_order(uuid) to authenticated;
grant execute on function public.cancel_store_order(uuid) to authenticated;
revoke execute on function public.assert_can_fulfil_order(uuid) from public, anon;

alter publication supabase_realtime add table public.inventory_orders;
