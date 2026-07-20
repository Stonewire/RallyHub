-- Crossword rework: 3-use hint reveals, per-word solve checks, and a
-- time+hint scoring model. All correctness stays server-side; answers never
-- leave the database.

alter table public.event_puzzle_progress
  add column if not exists hints_used integer not null default 0
    check (hints_used between 0 and 3),
  add column if not exists revealed_cells jsonb not null default '{}'::jsonb;

-- Solved <=300s with no hints = max. Each 30s block over 300s = -5%
-- (time rounded up). Each hint = -10%. Floor 10% of max.
-- Mirrors crosswordScore() in src/lib/puzzle-engine.ts.
drop function if exists public.puzzle_crossword_points(integer, numeric);
create or replace function public.puzzle_crossword_points(
  p_max_points integer,
  p_solve_seconds numeric,
  p_hints_used integer
)
returns integer
language sql
immutable
set search_path = public
as $$
  select greatest(
    round(
      greatest(p_max_points, 0)
      * greatest(
          0.10,
          1
          - 0.05 * ceil(greatest(0, greatest(p_solve_seconds, 0) - 300) / 30.0)
          - 0.10 * greatest(0, coalesce(p_hints_used, 0))
        )
    )::integer,
    ceil(greatest(p_max_points, 0) * 0.10)::integer
  );
$$;

-- Shared helper: which word ids are fully correct given a filled-cells map.
create or replace function public.crossword_solved_word_ids(
  p_words jsonb,
  p_cells jsonb
)
returns text[]
language plpgsql
immutable
set search_path = public
as $$
declare
  v_word jsonb;
  v_answer text;
  v_row integer;
  v_col integer;
  v_i integer;
  v_key text;
  v_ok boolean;
  v_ids text[] := '{}';
begin
  for v_word in select value from jsonb_array_elements(coalesce(p_words, '[]'::jsonb)) loop
    v_answer := lower(coalesce(v_word ->> 'answer', ''));
    v_row := (v_word ->> 'row')::integer;
    v_col := (v_word ->> 'col')::integer;
    v_ok := char_length(v_answer) > 0;
    for v_i in 0 .. char_length(v_answer) - 1 loop
      if v_word ->> 'direction' = 'down' then
        v_key := (v_row + v_i) || '-' || v_col;
      else
        v_key := v_row || '-' || (v_col + v_i);
      end if;
      if lower(coalesce(p_cells ->> v_key, '')) <> substr(v_answer, v_i + 1, 1) then
        v_ok := false;
      end if;
    end loop;
    if v_ok then
      v_ids := array_append(v_ids, v_word ->> 'id');
    end if;
  end loop;
  return v_ids;
end;
$$;

-- Payload now also reports hints, revealed cells, solved words and the
-- solve start time (created_at) so the client can run a live countdown.
create or replace function public.puzzle_progress_payload(
  p_event_id uuid,
  p_team_id uuid,
  p_game_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_config jsonb;
  v_progress public.event_puzzle_progress%rowtype;
  v_pairs jsonb;
  v_left_ids jsonb := '[]'::jsonb;
  v_right_ids jsonb := '[]'::jsonb;
  v_pair jsonb;
  v_solved text[] := '{}';
begin
  select g.config into v_config
  from public.games g
  where g.id = p_game_id and g.type = 'puzzle';

  if v_config is null then
    raise exception 'Puzzle not found.';
  end if;

  select p.* into v_progress
  from public.event_puzzle_progress p
  where p.event_id = p_event_id and p.team_id = p_team_id and p.game_id = p_game_id;

  if v_config ->> 'puzzle_type' = 'matching' and v_progress.team_id is not null then
    v_pairs := coalesce(v_config -> 'puzzle_matching_pairs', '[]'::jsonb);
    for v_pair in select value from jsonb_array_elements(v_pairs) loop
      if (v_pair ->> 'id') = any(v_progress.matched_pair_ids) then
        v_left_ids := v_left_ids || jsonb_build_array(v_pair ->> 'leftId');
        v_right_ids := v_right_ids || jsonb_build_array(v_pair ->> 'rightId');
      end if;
    end loop;
  end if;

  if v_config ->> 'puzzle_type' = 'crossword' and v_progress.team_id is not null then
    v_solved := public.crossword_solved_word_ids(
      coalesce(v_config -> 'puzzle_crossword_words', '[]'::jsonb),
      coalesce(v_progress.filled_cells, '{}'::jsonb)
    );
  end if;

  return jsonb_build_object(
    'puzzleType', v_config ->> 'puzzle_type',
    'attempts', coalesce(v_progress.attempts, 0),
    'wrongMatches', coalesce(v_progress.wrong_matches, 0),
    'guesses', coalesce(v_progress.wordle_guesses, '[]'::jsonb),
    'matchedLeftIds', v_left_ids,
    'matchedRightIds', v_right_ids,
    'filledCells', coalesce(v_progress.filled_cells, '{}'::jsonb),
    'revealedCells', coalesce(v_progress.revealed_cells, '{}'::jsonb),
    'hintsUsed', coalesce(v_progress.hints_used, 0),
    'solvedWordIds', to_jsonb(v_solved),
    'failedFullChecks', coalesce(v_progress.failed_full_checks, 0),
    'startedAt', v_progress.created_at,
    'solveSeconds', case
      when v_progress.completed_at is not null
      then floor(extract(epoch from v_progress.completed_at - v_progress.created_at))::integer
    end,
    'completed', v_progress.completed_at is not null,
    'pointsAwarded', v_progress.points_awarded
  );
end;
$$;

-- One hint: reveal the first still-empty cell of each unsolved word, deduped
-- where words cross. Server authored so answers never leak. Caps at 3.
create or replace function public.use_crossword_hint(
  p_event_id uuid,
  p_game_id uuid,
  p_team_token text,
  p_cells jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_config jsonb;
  v_event_status text;
  v_stage jsonb;
  v_submissions_open boolean;
  v_progress public.event_puzzle_progress%rowtype;
  v_solved text[];
  v_word jsonb;
  v_answer text;
  v_row integer;
  v_col integer;
  v_i integer;
  v_key text;
  v_filled jsonb;
  v_reveals jsonb := '{}'::jsonb;
begin
  if not public.live_join_token_matches_event(p_event_id) then
    raise exception 'Event access has expired. Reload the team page.';
  end if;

  v_team_id := public.puzzle_team_for_token(p_event_id, p_team_token);
  if v_team_id is null then
    raise exception 'This phone is not authorized for a team. Rejoin the event.';
  end if;

  select g.config, e.status,
         e.stages_config -> es.current_stage_index, es.submissions_open
  into v_config, v_event_status, v_stage, v_submissions_open
  from public.event_games eg
  join public.games g on g.id = eg.game_id and g.type = 'puzzle'
  join public.events e on e.id = eg.event_id
  join public.event_state es on es.event_id = e.id
  where eg.event_id = p_event_id and eg.game_id = p_game_id;

  if v_config is null or v_config ->> 'puzzle_type' <> 'crossword' then
    raise exception 'Crossword puzzle not found.';
  end if;
  if v_event_status not in ('active', 'demo') or not coalesce(v_submissions_open, false) then
    raise exception 'This event is not accepting answers.';
  end if;
  if v_stage ->> 'type' <> 'open' or not exists (
    select 1 from jsonb_array_elements_text(coalesce(v_stage -> 'gameIds', '[]'::jsonb)) game_id
    where game_id = p_game_id::text
  ) then
    raise exception 'This puzzle is not in the current Quest stage.';
  end if;

  insert into public.event_puzzle_progress (event_id, team_id, game_id, puzzle_type)
  values (p_event_id, v_team_id, p_game_id, 'crossword')
  on conflict (event_id, team_id, game_id) do nothing;

  select p.* into v_progress
  from public.event_puzzle_progress p
  where p.event_id = p_event_id and p.team_id = v_team_id and p.game_id = p_game_id
  for update;

  if v_progress.completed_at is not null or v_progress.hints_used >= 3 then
    return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id);
  end if;

  -- Start from the caller's current fill so we do not re-reveal filled cells.
  v_filled := coalesce(p_cells, v_progress.filled_cells, '{}'::jsonb);
  v_solved := public.crossword_solved_word_ids(
    coalesce(v_config -> 'puzzle_crossword_words', '[]'::jsonb), v_filled);

  for v_word in
    select value from jsonb_array_elements(coalesce(v_config -> 'puzzle_crossword_words', '[]'::jsonb))
  loop
    if (v_word ->> 'id') = any(v_solved) then
      continue;
    end if;
    v_answer := lower(coalesce(v_word ->> 'answer', ''));
    v_row := (v_word ->> 'row')::integer;
    v_col := (v_word ->> 'col')::integer;
    for v_i in 0 .. char_length(v_answer) - 1 loop
      if v_word ->> 'direction' = 'down' then
        v_key := (v_row + v_i) || '-' || v_col;
      else
        v_key := v_row || '-' || (v_col + v_i);
      end if;
      -- first cell not already correct and not already granted this pass
      if lower(coalesce(v_filled ->> v_key, '')) <> substr(v_answer, v_i + 1, 1)
         and not (v_reveals ? v_key) then
        v_reveals := v_reveals || jsonb_build_object(v_key, upper(substr(v_answer, v_i + 1, 1)));
        exit;
      end if;
    end loop;
  end loop;

  update public.event_puzzle_progress
  set hints_used = v_progress.hints_used + 1,
      revealed_cells = coalesce(revealed_cells, '{}'::jsonb) || v_reveals,
      filled_cells = v_filled || v_reveals,
      updated_at = now()
  where event_id = p_event_id and team_id = v_team_id and game_id = p_game_id;

  return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id);
end;
$$;

-- Per-word check + completion award. Saves the fill, and when every word is
-- correct marks completion and awards using time + hints.
create or replace function public.validate_crossword_grid(
  p_event_id uuid,
  p_game_id uuid,
  p_team_token text,
  p_cells jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_config jsonb;
  v_points integer;
  v_event_status text;
  v_stage jsonb;
  v_submissions_open boolean;
  v_progress public.event_puzzle_progress%rowtype;
  v_words jsonb;
  v_solved text[];
  v_total integer;
  v_all boolean;
  v_solve_seconds integer;
  v_awarded integer;
begin
  if not public.live_join_token_matches_event(p_event_id) then
    raise exception 'Event access has expired. Reload the team page.';
  end if;

  v_team_id := public.puzzle_team_for_token(p_event_id, p_team_token);
  if v_team_id is null then
    raise exception 'This phone is not authorized for a team. Rejoin the event.';
  end if;

  select g.config, greatest(coalesce(g.points_static, 100), 1), e.status,
         e.stages_config -> es.current_stage_index, es.submissions_open
  into v_config, v_points, v_event_status, v_stage, v_submissions_open
  from public.event_games eg
  join public.games g on g.id = eg.game_id and g.type = 'puzzle'
  join public.events e on e.id = eg.event_id
  join public.event_state es on es.event_id = e.id
  where eg.event_id = p_event_id and eg.game_id = p_game_id;

  if v_config is null or v_config ->> 'puzzle_type' <> 'crossword' then
    raise exception 'Crossword puzzle not found.';
  end if;
  if v_event_status not in ('active', 'demo') or not coalesce(v_submissions_open, false) then
    raise exception 'This event is not accepting answers.';
  end if;
  if v_stage ->> 'type' <> 'open' or not exists (
    select 1 from jsonb_array_elements_text(coalesce(v_stage -> 'gameIds', '[]'::jsonb)) game_id
    where game_id = p_game_id::text
  ) then
    raise exception 'This puzzle is not in the current Quest stage.';
  end if;

  insert into public.event_puzzle_progress (event_id, team_id, game_id, puzzle_type)
  values (p_event_id, v_team_id, p_game_id, 'crossword')
  on conflict (event_id, team_id, game_id) do nothing;

  select p.* into v_progress
  from public.event_puzzle_progress p
  where p.event_id = p_event_id and p.team_id = v_team_id and p.game_id = p_game_id
  for update;

  if v_progress.completed_at is not null then
    return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id);
  end if;

  v_words := coalesce(v_config -> 'puzzle_crossword_words', '[]'::jsonb);
  v_total := jsonb_array_length(v_words);
  v_solved := public.crossword_solved_word_ids(v_words, coalesce(p_cells, '{}'::jsonb));
  v_all := v_total > 0 and cardinality(v_solved) = v_total;

  if v_all then
    v_solve_seconds := floor(extract(epoch from now() - v_progress.created_at))::integer;
    v_awarded := public.puzzle_crossword_points(v_points, v_solve_seconds, v_progress.hints_used);

    update public.event_puzzle_progress
    set filled_cells = coalesce(p_cells, '{}'::jsonb),
        completed_at = now(),
        points_awarded = v_awarded,
        updated_at = now()
    where event_id = p_event_id and team_id = v_team_id and game_id = p_game_id;

    perform set_config('rallyhub.puzzle_score_award', 'on', true);
    insert into public.submissions (
      event_id, team_id, game_id, media_url, media_type, status, points_awarded
    ) values (
      p_event_id, v_team_id, p_game_id, 'crossword:' || v_solve_seconds,
      'puzzle', 'approved', v_awarded
    );
    update public.teams set score = score + v_awarded where id = v_team_id;
    perform set_config('rallyhub.puzzle_score_award', 'off', true);
  else
    update public.event_puzzle_progress
    set filled_cells = coalesce(p_cells, '{}'::jsonb),
        updated_at = now()
    where event_id = p_event_id and team_id = v_team_id and game_id = p_game_id;
  end if;

  return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id)
    || jsonb_build_object('lastCheckCorrect', v_all);
end;
$$;

revoke all on function public.use_crossword_hint(uuid, uuid, text, jsonb) from public;
grant execute on function public.use_crossword_hint(uuid, uuid, text, jsonb) to anon, authenticated;
revoke all on function public.puzzle_crossword_points(integer, numeric, integer) from public;
revoke all on function public.crossword_solved_word_ids(jsonb, jsonb) from public;
