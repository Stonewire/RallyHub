-- R2.5: resetting a team slot left its puzzles solved. The facilitator's
-- "reset slot" action was client-side (delete the team's submissions, then
-- UPDATE the teams row back to name/photo null, score 0, status idle). The
-- slot keeps its team id, so everything else keyed by that id survived:
--   * event_puzzle_progress rows, so the next team claiming the slot opened
--     every puzzle board already solved and earned no points (the bug);
--   * the inventory_team_access row, so the OLD device's per-device purchase
--     token stayed valid until someone re-claimed the slot, and its queued
--     offline drains could still land in the freshly cleared team;
--   * the team's inventory_orders, which lingered in the store order queue
--     under the new team's name.
-- The full event reset (reset_event_data) never had this class of bug because
-- it deletes the teams rows outright and cascades all of the above away.
--
-- Fix: one SECURITY DEFINER RPC that clears the whole slot atomically and
-- returns the emptied teams row. Auth guard copied from restart_quiz_scores
-- (082 + 20260713101933): is_facilitator_for_event, i.e. facilitator,
-- event_manager or client_admin of the event's org, or super_admin.
--
-- session_epoch is deliberately NOT bumped. The claim path stores the epoch
-- read from the (possibly stale) lobby bundle, so a bump here could falsely
-- log out a player who re-claims the slot seconds after the reset. Kicking a
-- live device off a team stays takeover_team_slot's job; the token delete
-- below already refuses any write the stale device attempts.
-- bingo_team_cards are also left alone: cards belong to the run, and a team
-- joining mid-run is the known H6 territory this reset must not reshape.

create or replace function public.reset_team(
  p_event_id uuid,
  p_team_id uuid
)
returns setof public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.teams%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_facilitator_for_event(p_event_id) then
    raise exception 'Facilitator access required';
  end if;

  select t.* into v_team
  from public.teams t
  where t.id = p_team_id and t.event_id = p_event_id
  for update;

  if v_team.id is null then
    raise exception 'Team not found';
  end if;

  delete from public.submissions
  where event_id = p_event_id and team_id = p_team_id;

  delete from public.event_puzzle_progress
  where event_id = p_event_id and team_id = p_team_id;

  -- inventory_order_items cascade from inventory_orders.
  delete from public.inventory_orders
  where event_id = p_event_id and team_id = p_team_id;

  -- Invalidates the old device's team/purchase token immediately, so a stale
  -- device's queued offline submissions and store orders are refused
  -- server-side instead of landing in the cleared slot. The next claim mints
  -- a fresh token via claim_team_with_inventory_access as usual.
  delete from public.inventory_team_access
  where team_id = p_team_id;

  -- language resets too: the pinned choice belonged to the old team, and a
  -- new team claiming the slot should follow the event language again.
  update public.teams t
  set name = null,
      photo_url = null,
      score = 0,
      status = 'idle',
      language = null
  where t.id = p_team_id
  returning t.* into v_team;

  return next v_team;
end;
$$;

revoke execute on function public.reset_team(uuid, uuid) from public, anon;
grant execute on function public.reset_team(uuid, uuid) to authenticated;

comment on function public.reset_team(uuid, uuid) is
  'Facilitator slot reset: atomically deletes the team''s submissions, puzzle progress, store orders and per-device purchase token, then restores the empty-slot teams row (name/photo/language null, score 0, status idle). Returns the emptied row. Facilitator auth required; session_epoch is left alone (takeover_team_slot owns device kicks).';
