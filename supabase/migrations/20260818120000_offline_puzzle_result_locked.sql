-- Review findings C1/C5: submit_offline_puzzle_result could double-score.
-- (1) Two devices of one team draining concurrently: both passed the plain
--     check-then-insert (no unique constraint on team+game) and both bumped
--     the score. (2) It never wrote event_puzzle_progress, so a teammate's
--     online device still saw the puzzle as unplayed and could solve it again
--     through the online RPCs, whose only guard is progress.completed_at.
--
-- Fix: serialise exactly like the online RPCs — upsert the progress row, lock
-- it FOR UPDATE, bail to the existing submission when already completed, and
-- mark completed_at/points on success so the online path is closed too. A
-- partial unique index on submissions is the belt-and-braces backstop
-- (verified: no existing duplicates in production).

create unique index if not exists submissions_one_puzzle_per_team_game
  on public.submissions (team_id, game_id)
  where media_type = 'puzzle';

create or replace function public.submit_offline_puzzle_result(
  p_event_id uuid,
  p_game_id uuid,
  p_team_token text,
  p_client_id uuid,
  p_result jsonb,
  p_created_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_team_id uuid;
  v_event_status text;
  v_config jsonb;
  v_type text;
  v_points integer;
  v_awarded integer;
  v_media text;
  v_progress public.event_puzzle_progress%rowtype;
  v_existing public.submissions%rowtype;
  v_row public.submissions%rowtype;
  v_answer text;
  v_guesses jsonb;
  v_attempts integer;
  v_last text;
  v_cells jsonb;
  v_words jsonb;
  v_solved text[];
  v_word_count integer;
  v_hints integer;
  v_wrong integer;
begin
  select e.status into v_event_status from public.events e where e.id = p_event_id;
  if v_event_status is null or v_event_status not in ('active', 'ready', 'demo') then
    raise exception 'This event is not live.' using errcode = 'P0001';
  end if;

  select a.team_id into v_team_id
  from public.inventory_team_access a
  where a.event_id = p_event_id
    and a.token_hash = digest(coalesce(p_team_token, ''), 'sha256');
  if v_team_id is null then
    raise exception 'This phone is not authorized for that team. Rejoin the event.'
      using errcode = 'P0001';
  end if;

  select g.config, greatest(coalesce(g.points_static, 100), 1)
    into v_config, v_points
  from public.games g
  join public.event_games eg on eg.game_id = g.id and eg.event_id = p_event_id
  where g.id = p_game_id and g.type = 'puzzle';
  if v_config is null then
    raise exception 'This game is not a puzzle on this event.' using errcode = 'P0001';
  end if;
  v_type := v_config ->> 'puzzle_type';

  -- The serialisation point the online RPCs use: concurrent drains (and any
  -- concurrent online play) queue on this row lock.
  insert into public.event_puzzle_progress (event_id, team_id, game_id, puzzle_type)
  values (p_event_id, v_team_id, p_game_id, coalesce(v_type, 'wordle'))
  on conflict (event_id, team_id, game_id) do nothing;

  select p.* into v_progress
  from public.event_puzzle_progress p
  where p.event_id = p_event_id and p.team_id = v_team_id and p.game_id = p_game_id
  for update;

  select * into v_existing
  from public.submissions s
  where s.id = p_client_id
     or (s.team_id = v_team_id and s.game_id = p_game_id and s.media_type = 'puzzle')
  order by (s.id = p_client_id) desc
  limit 1;
  if v_progress.completed_at is not null or v_existing.id is not null then
    -- Already finished (this retry, a concurrent drain that beat us, or a
    -- teammate online). Hand back the landed row, award nothing.
    if v_existing.id is not null then
      return to_jsonb(v_existing);
    end if;
    return null;
  end if;

  if v_type = 'wordle' then
    v_answer := lower(coalesce(v_config ->> 'puzzle_wordle_answer', ''));
    v_guesses := coalesce(p_result -> 'guesses', '[]'::jsonb);
    v_attempts := jsonb_array_length(v_guesses);
    if v_attempts < 1 or char_length(v_answer) = 0 then
      raise exception 'Incomplete puzzle result.' using errcode = 'P0001';
    end if;
    v_last := lower(coalesce(v_guesses ->> (v_attempts - 1), ''));
    if v_last <> v_answer then
      raise exception 'The final guess does not solve this puzzle.' using errcode = 'P0001';
    end if;
    v_awarded := public.puzzle_wordle_points(v_points, v_attempts);
    v_media := 'wordle:' || v_attempts;
    v_hints := 0;
    v_wrong := 0;

  elsif v_type = 'matching' then
    v_attempts := greatest(coalesce((p_result ->> 'attempts')::integer, 0), 0);
    v_wrong := greatest(coalesce((p_result ->> 'wrongMatches')::integer, 0), 0);
    v_awarded := public.puzzle_matching_points(v_points, v_wrong);
    v_media := 'matching:' || v_attempts;
    v_hints := 0;

  elsif v_type = 'crossword' then
    v_cells := coalesce(p_result -> 'cells', '{}'::jsonb);
    v_words := coalesce(v_config -> 'puzzle_crossword_words', '[]'::jsonb);
    v_word_count := jsonb_array_length(v_words);
    v_solved := public.crossword_solved_word_ids(v_words, v_cells);
    if v_word_count = 0 or coalesce(array_length(v_solved, 1), 0) < v_word_count then
      raise exception 'The grid does not solve this puzzle.' using errcode = 'P0001';
    end if;
    v_hints := greatest(coalesce((p_result ->> 'hintsUsed')::integer, 0), 0);
    v_awarded := public.puzzle_crossword_points(
      v_points,
      greatest(coalesce((p_result ->> 'solveSeconds')::numeric, 0), 0),
      v_hints
    );
    v_media := 'crossword:' || round(greatest(coalesce((p_result ->> 'solveSeconds')::numeric, 0), 0));
    v_attempts := coalesce(v_progress.attempts, 0);
    v_wrong := 0;

  else
    raise exception 'Unknown puzzle type.' using errcode = 'P0001';
  end if;

  perform set_config('rallyhub.puzzle_score_award', 'on', true);
  begin
    insert into public.submissions (
      id, event_id, team_id, game_id, media_url, media_type, status, points_awarded, created_at
    ) values (
      p_client_id, p_event_id, v_team_id, p_game_id, v_media, 'puzzle', 'approved',
      v_awarded, coalesce(p_created_at, now())
    )
    returning * into v_row;
    update public.teams set score = score + v_awarded where id = v_team_id;
  exception when unique_violation then
    perform set_config('rallyhub.puzzle_score_award', 'off', true);
    select * into v_row
    from public.submissions s
    where s.id = p_client_id
       or (s.team_id = v_team_id and s.game_id = p_game_id and s.media_type = 'puzzle')
    order by (s.id = p_client_id) desc
    limit 1;
    return to_jsonb(v_row);
  end;
  perform set_config('rallyhub.puzzle_score_award', 'off', true);

  -- Close the puzzle for the ONLINE path too: its RPCs bail on completed_at.
  update public.event_puzzle_progress
  set completed_at = coalesce(p_created_at, now()),
      points_awarded = v_awarded,
      attempts = greatest(coalesce(attempts, 0), coalesce(v_attempts, 0)),
      wrong_matches = greatest(coalesce(wrong_matches, 0), coalesce(v_wrong, 0)),
      hints_used = greatest(coalesce(hints_used, 0), coalesce(v_hints, 0)),
      updated_at = now()
  where event_id = p_event_id and team_id = v_team_id and game_id = p_game_id;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.submit_offline_puzzle_result(uuid, uuid, text, uuid, jsonb, timestamptz)
  to anon, authenticated;
