-- Partial order completion (CF4-2, Rumen 8 Aug evening).
--
-- "Complete all" completed the whole order; real tables sometimes hand over
-- only part of it. Now the facilitator ticks what was actually handed over
-- and presses "Complete selected and take X points": ONLY the ticked items
-- are completed and only their points move. Unticked items stay pending in
-- the same order for later. No points move before that button.
--
-- Model: inventory_order_items.completed_at marks paid-and-handed-over per
-- item. The order goes 'done' when every item is completed. Cancel releases
-- only the uncompleted items (deletes them, freeing reserved stock, and
-- recomputes total_points); a fully uncompleted order cancels outright.
--
-- Grants restated per function: forgetting them is how wipe_event_data
-- shipped broken.

alter table public.inventory_order_items
  add column if not exists completed_at timestamptz;

drop function if exists public.complete_store_order(uuid);

create function public.complete_store_order(p_order_id uuid)
returns table(team_id uuid, remaining_score integer, taken_points integer, order_done boolean)
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_order public.inventory_orders%rowtype;
  v_team public.teams%rowtype;
  v_points integer;
  v_left integer;
begin
  v_order := public.assert_can_fulfil_order(p_order_id);
  if v_order.status <> 'pending' then
    raise exception 'This order is already %.', v_order.status;
  end if;

  select coalesce(sum(i.quantity * i.points_cost_each), 0)
  into v_points
  from public.inventory_order_items i
  where i.order_id = p_order_id and i.fulfilled and i.completed_at is null;

  if v_points = 0 and not exists (
    select 1 from public.inventory_order_items i
    where i.order_id = p_order_id and i.fulfilled and i.completed_at is null
  ) then
    raise exception 'Tick the items you are handing over first.';
  end if;

  select t.* into v_team from public.teams t where t.id = v_order.team_id for update;
  if v_team.score < v_points then
    raise exception 'The team has % points but the selected items cost %. Untick something or adjust their score first.',
      v_team.score, v_points;
  end if;

  perform set_config('rallyhub.inventory_score_deduction', 'on', true);
  update public.teams set score = score - v_points
  where id = v_team.id returning score into v_team.score;
  perform set_config('rallyhub.inventory_score_deduction', 'off', true);

  update public.inventory_order_items
  set completed_at = now()
  where order_id = p_order_id and fulfilled and completed_at is null;

  select count(*) into v_left
  from public.inventory_order_items i
  where i.order_id = p_order_id and i.completed_at is null;

  if v_left = 0 then
    update public.inventory_orders
    set status = 'done', completed_at = now()
    where id = p_order_id;
  end if;

  return query select v_team.id, v_team.score, v_points, v_left = 0;
end;
$$;

create or replace function public.cancel_store_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_order public.inventory_orders%rowtype;
  v_completed integer;
begin
  v_order := public.assert_can_fulfil_order(p_order_id);
  if v_order.status <> 'pending' then
    raise exception 'This order is already %.', v_order.status;
  end if;

  select count(*) into v_completed
  from public.inventory_order_items i
  where i.order_id = p_order_id and i.completed_at is not null;

  -- Uncompleted items go back on sale; completed ones were paid for and stand.
  delete from public.inventory_order_items
  where order_id = p_order_id and completed_at is null;

  if v_completed = 0 then
    update public.inventory_orders set status = 'cancelled' where id = p_order_id;
  else
    update public.inventory_orders
    set status = 'done',
        completed_at = now(),
        total_points = coalesce((
          select sum(i.quantity * i.points_cost_each)
          from public.inventory_order_items i
          where i.order_id = p_order_id
        ), 0)
    where id = p_order_id;
  end if;
end;
$$;

revoke all on function public.complete_store_order(uuid) from public, anon;
grant execute on function public.complete_store_order(uuid) to authenticated;
revoke all on function public.cancel_store_order(uuid) from public, anon;
grant execute on function public.cancel_store_order(uuid) to authenticated;
