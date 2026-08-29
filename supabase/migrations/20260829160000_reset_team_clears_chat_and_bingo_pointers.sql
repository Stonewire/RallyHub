-- R2.5 follow-up: reset_team (20260829121000) cleared the slot's gameplay rows
-- but not everything else keyed to the team. Same root cause as the original
-- bug: the slot keeps its team id, so anything pointing at that id survives.
--
-- The serious one is a content leak. chat_messages was never cleared, and chat
-- is fetched event-wide and filtered purely by team_id on both sides (the
-- facilitator drawer and the player view). A new team claiming the slot on a
-- brand new phone therefore read the OLD team's entire private conversation
-- with the facilitator. Team-scoped rows go; broadcast messages (team_id null)
-- belong to the room rather than the slot, so those stay.
--
-- The rest are stale pointers at a team that no longer exists:
--   * event_state.bingo_winner_team_id kept celebrating the reset team, and
--     bingo_announced_winner_ids kept its id on the already-announced list,
--     which would then have swallowed the new team's own win;
--   * bingo_runs.paid_line_bonus_team_ids still recorded the line bonus as
--     paid, so the slot could never earn it again;
--   * bingo_run_secrets.winner_team_id (service-role only, no reader today)
--     held a row for the reset team.
--   * inventory_purchases, the legacy pre-store purchase log: no live reader
--     today, but the rows are per-team and would otherwise outlive the team
--     they belonged to and resurface under the new team's name.
--
-- Everything from the original definition is unchanged, including the two
-- deliberate omissions:
--
-- session_epoch is deliberately NOT bumped. The claim path stores the epoch
-- read from the (possibly stale) lobby bundle, so a bump here could falsely
-- log out a player who re-claims the slot seconds after the reset. Kicking a
-- live device off a team stays takeover_team_slot's job; the token delete
-- below already refuses any write the stale device attempts.
-- bingo_team_cards are also left alone: cards belong to the run, and a team
-- joining mid-run is the known H6 territory this reset must not reshape.
--
-- client_diagnostics keeps its rows too: it is a write-only staff debug log,
-- no live surface reads it, and binning the error trail from the very device
-- that needed a reset would defeat the point of collecting it.

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

  -- Only the slot's private thread. Broadcast messages carry team_id null.
  delete from public.chat_messages
  where event_id = p_event_id and team_id = p_team_id;

  delete from public.event_puzzle_progress
  where event_id = p_event_id and team_id = p_team_id;

  -- inventory_order_items cascade from inventory_orders.
  delete from public.inventory_orders
  where event_id = p_event_id and team_id = p_team_id;

  delete from public.inventory_purchases
  where event_id = p_event_id and team_id = p_team_id;

  -- Invalidates the old device's team/purchase token immediately, so a stale
  -- device's queued offline submissions and store orders are refused
  -- server-side instead of landing in the cleared slot. The next claim mints
  -- a fresh token via claim_team_with_inventory_access as usual.
  delete from public.inventory_team_access
  where team_id = p_team_id;

  -- Team ids are event-scoped, so winner_team_id alone is exact here (and it
  -- is the indexed column). The row cannot be blanked: winner_team_id is NOT
  -- NULL, so the whole secret goes.
  delete from public.bingo_run_secrets
  where winner_team_id = p_team_id;

  -- Re-arms the line bonus for whoever claims the slot next. Mid-run that
  -- means a new team inheriting the old card can be paid for a line it did
  -- not fill, which is the same H6 territory the card decision above lives
  -- in; a slot that can never earn the bonus again is the worse outcome.
  update public.bingo_runs br
  set paid_line_bonus_team_ids = br.paid_line_bonus_team_ids - p_team_id::text
  where br.event_id = p_event_id
    and br.paid_line_bonus_team_ids @> to_jsonb(p_team_id::text);

  -- Guarded so a routine slot reset does not bump updated_at and push a
  -- pointless event_state snapshot at every connected device; when it does
  -- fire, updated_at must move or the 4s poll treats the row as stale
  -- (same reason as 20260715093831).
  update public.event_state es
  set bingo_winner_team_id = case
        when es.bingo_winner_team_id = p_team_id::text then null
        else es.bingo_winner_team_id
      end,
      bingo_announced_winner_ids = es.bingo_announced_winner_ids - p_team_id::text,
      updated_at = now()
  where es.event_id = p_event_id
    and (
      es.bingo_winner_team_id = p_team_id::text
      or es.bingo_announced_winner_ids @> to_jsonb(p_team_id::text)
    );

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
  'Facilitator slot reset: atomically deletes the team''s submissions, private chat, puzzle progress, store orders and purchases, per-device purchase token and bingo winner traces (event_state winner/announced ids, run line-bonus record, run secret), then restores the empty-slot teams row (name/photo/language null, score 0, status idle). Returns the emptied row. Facilitator auth required; session_epoch and bingo_team_cards are left alone (takeover_team_slot owns device kicks; cards belong to the run).';

-- Repair for slots already reset by the client-side path or by the first
-- version of this RPC.
--
-- Redefining the function only protects future resets. Slots reset before this
-- migration still carry the old occupant's private thread, so the leak is
-- waiting to fire the moment someone claims one of them (the 29 Aug pass found
-- six such slots across three events). A blank team name is exactly the
-- empty-slot marker reset_team writes, and a team cannot chat before it is
-- claimed and named, so every row this matches belonged to an occupant that no
-- longer exists. Broadcast messages carry team_id null and never join.
--
-- Chat is a live-only surface: no report, export or admin screen reads
-- chat_messages, so nothing downstream loses history.
delete from public.chat_messages m
using public.teams t
where t.id = m.team_id
  and nullif(trim(t.name), '') is null;
