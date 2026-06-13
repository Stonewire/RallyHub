-- Atomic team score adjustments for live scoring (audit H1).

create or replace function public.increment_team_score(p_team_id uuid, p_delta int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.teams
  set score = score + p_delta
  where id = p_team_id;
$$;

grant execute on function public.increment_team_score(uuid, int) to anon, authenticated;

comment on function public.increment_team_score(uuid, int) is
  'Atomically add p_delta to teams.score (negative for reversals). Used by all live scoring paths.';
