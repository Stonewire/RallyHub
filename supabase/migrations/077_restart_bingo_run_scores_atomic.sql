-- P1-3: reverse bingo scores and clear the run in one transaction, so a score
-- landing mid-restart can't leave a team's total stale. Replaces the client
-- read-sum-then-decrement loop. Applied to production via the connector 2026-07-01.
create or replace function public.restart_bingo_run_scores(
  p_event_id uuid,
  p_game_id uuid,
  p_stage_index int,
  p_line_points int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_facilitator_for_event(p_event_id) then
    raise exception 'Facilitator access required';
  end if;

  -- Reverse approved submission points per team.
  for r in
    select team_id, sum(coalesce(points_awarded, 0)) as pts
    from public.submissions
    where event_id = p_event_id and game_id = p_game_id and status = 'approved'
    group by team_id
  loop
    if r.pts <> 0 then
      update public.teams set score = score - r.pts where id = r.team_id;
    end if;
  end loop;

  -- Reverse line bonuses recorded on the run.
  if p_line_points > 0 then
    update public.teams t
    set score = score - p_line_points
    from public.bingo_runs br
    where br.event_id = p_event_id
      and br.stage_index = p_stage_index
      and br.paid_line_bonus_team_ids @> to_jsonb(t.id::text);
  end if;

  delete from public.bingo_runs where event_id = p_event_id and stage_index = p_stage_index;
  delete from public.submissions where event_id = p_event_id and game_id = p_game_id;
end;
$$;

revoke execute on function public.restart_bingo_run_scores(uuid, uuid, int, int) from anon;
grant execute on function public.restart_bingo_run_scores(uuid, uuid, int, int) to authenticated;

comment on function public.restart_bingo_run_scores(uuid, uuid, int, int) is
  'Atomically reverse bingo scores (correct cells + line bonus) and delete the run and its submissions for a stage restart. Facilitator auth required.';
