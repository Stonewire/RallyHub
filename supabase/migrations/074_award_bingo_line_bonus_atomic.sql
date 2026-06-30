-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE — Atomic bingo line-bonus award (P0-1)
-- ═══════════════════════════════════════════════════════════════════════════
-- Fixes a double-pay race. scoreBingoRound used to read paid_line_bonus_team_ids,
-- decide whether to pay, award the points, then write the array back from the
-- client. Two concurrent score calls (two facilitator tabs, or auto-reveal
-- racing a manual reveal) both read the team as unpaid and both awarded the
-- line bonus, inflating the leaderboard.
--
-- This RPC claims and pays the bonus in one transaction under a row lock on the
-- run. It returns true only the first time a given team is awarded for a given
-- run; every later call for the same team returns false and changes nothing.

create or replace function public.award_bingo_line_bonus(
  p_run_id uuid,
  p_team_id uuid,
  p_points int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_already  boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select t.event_id into v_event_id
  from public.teams t
  where t.id = p_team_id;

  if v_event_id is null then
    raise exception 'Team not found';
  end if;

  if not public.is_facilitator_for_event(v_event_id) then
    raise exception 'Facilitator access required';
  end if;

  -- Lock the run row so concurrent score calls serialise on this check.
  select (paid_line_bonus_team_ids @> to_jsonb(p_team_id::text))
    into v_already
  from public.bingo_runs
  where id = p_run_id
  for update;

  if not found then
    raise exception 'Bingo run not found';
  end if;

  if coalesce(v_already, false) then
    return false;
  end if;

  update public.bingo_runs
  set paid_line_bonus_team_ids =
    paid_line_bonus_team_ids || to_jsonb(p_team_id::text)
  where id = p_run_id;

  if p_points > 0 then
    update public.teams
    set score = score + p_points
    where id = p_team_id;
  end if;

  return true;
end;
$$;

revoke execute on function public.award_bingo_line_bonus(uuid, uuid, int) from anon;
grant execute on function public.award_bingo_line_bonus(uuid, uuid, int) to authenticated;

comment on function public.award_bingo_line_bonus(uuid, uuid, int) is
  'Atomically claim and pay the bingo line bonus once per (run, team). Returns true only on the first award. Facilitator auth required.';

notify pgrst, 'reload schema';
