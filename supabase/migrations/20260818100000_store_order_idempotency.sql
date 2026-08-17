-- OFFLINE-1 Stage 5: make placing a store order idempotent.
--
-- Orders now travel through the offline outbox, which retries on a lost
-- response. place_store_order generated its id server-side with no unique
-- guard, so a blind retry would double-order. It now accepts the client's
-- order id: a replay whose id already exists returns the original result and
-- changes nothing. The FOR UPDATE event lock the function already takes
-- serialises concurrent drains, making the check-then-insert safe.
drop function if exists public.place_store_order(uuid, text, jsonb);

create or replace function public.place_store_order(
  p_event_id uuid,
  p_purchase_token text,
  p_items jsonb,
  p_client_order_id uuid default null
)
returns table(order_id uuid, total_points integer)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
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
  v_existing public.inventory_orders%rowtype;
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

  -- Idempotent replay: this order already landed on an attempt whose response
  -- was lost. Return the original result, change nothing.
  if p_client_order_id is not null then
    select o.* into v_existing
    from public.inventory_orders o
    where o.id = p_client_order_id
      and o.event_id = p_event_id
      and o.team_id = v_team_id;
    if v_existing.id is not null then
      return query select v_existing.id, v_existing.total_points;
      return;
    end if;
  end if;

  select t.* into v_team from public.teams t
  where t.id = v_team_id and t.event_id = p_event_id and t.status = 'active';
  if v_team.id is null then
    raise exception 'Your team is not active in this event.';
  end if;

  insert into public.inventory_orders (id, event_id, team_id, organization_id, status, total_points)
  values (coalesce(p_client_order_id, gen_random_uuid()), p_event_id, v_team_id, v_org, 'pending', 0)
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
$function$;

grant execute on function public.place_store_order(uuid, text, jsonb, uuid) to anon, authenticated;
