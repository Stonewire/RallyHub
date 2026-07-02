-- P1-3b: quiz twin of 077. Reverse approved quiz points and delete the game's
-- submissions in one transaction, replacing the client loop in restartQuiz
-- that summed from client memory and deleted rows one by one (stale totals if
-- an answer landed mid-restart).
create or replace function public.restart_quiz_scores(
  p_event_id uuid,
  p_game_id uuid
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

  delete from public.submissions where event_id = p_event_id and game_id = p_game_id;
end;
$$;

revoke execute on function public.restart_quiz_scores(uuid, uuid) from anon;
grant execute on function public.restart_quiz_scores(uuid, uuid) to authenticated;

comment on function public.restart_quiz_scores(uuid, uuid) is
  'Atomically reverse approved quiz points and delete the game''s submissions for a quiz restart. Facilitator auth required.';
