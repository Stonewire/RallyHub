-- Crossword puzzle subtype: manual 5x5 grids, silent full-grid validation,
-- time-decay scoring computed from database timestamps only.

alter table public.event_puzzle_progress
  drop constraint if exists event_puzzle_progress_puzzle_type_check;
alter table public.event_puzzle_progress
  add constraint event_puzzle_progress_puzzle_type_check
  check (puzzle_type in ('wordle', 'matching', 'crossword'));

alter table public.event_puzzle_progress
  add column if not exists filled_cells jsonb not null default '{}'::jsonb,
  add column if not exists failed_full_checks integer not null default 0
    check (failed_full_checks >= 0);

-- Solved within 120s = max. Each FULL extra minute removes 10% of remaining.
-- Floor 25% of max. Mirrors crosswordScore() in src/lib/puzzle-engine.ts.
create or replace function public.puzzle_crossword_points(
  p_max_points integer,
  p_solve_seconds numeric
)
returns integer
language sql
immutable
set search_path = public
as $$
  select greatest(
    round(
      greatest(p_max_points, 0)
      * power(0.90, greatest(0, floor((greatest(p_solve_seconds, 0) - 120) / 60)))
    )::integer,
    ceil(greatest(p_max_points, 0) * 0.25)::integer
  );
$$;

-- The live bundle may show the puzzle board, but never its solution. The
-- crossword's public layout (puzzle_crossword_layout) is derived answer-free at
-- edit time, so redaction only has to drop the private word list.
create or replace function public.redact_game_config_for_live(
  p_config jsonb,
  p_game_type text,
  p_quiz_state text,
  p_current_question_index integer,
  p_bingo_state text
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  result jsonb := coalesce(p_config, '{}'::jsonb);
  questions jsonb;
  challenges jsonb;
  pairs jsonb;
  out_questions jsonb := '[]'::jsonb;
  out_challenges jsonb := '[]'::jsonb;
  out_left jsonb := '[]'::jsonb;
  out_right jsonb := '[]'::jsonb;
  i int;
  elem jsonb;
begin
  if p_game_type = 'quiz' then
    questions := coalesce(result -> 'questions', '[]'::jsonb);
    if jsonb_array_length(questions) > 0 then
      for i in 0 .. jsonb_array_length(questions) - 1 loop
        elem := questions -> i;
        if public.quiz_question_answers_visible(
          coalesce(p_quiz_state, 'idle'),
          coalesce(p_current_question_index, 0),
          i
        ) then
          out_questions := out_questions || jsonb_build_array(elem);
        else
          out_questions := out_questions || jsonb_build_array(elem - 'correctAnswerId');
        end if;
      end loop;
    end if;
    result := jsonb_set(result, '{questions}', out_questions, true);
  elsif p_game_type = 'text' then
    -- Include both the original camelCase aliases and the current snake_case
    -- editor fields. The earlier redactor removed only the legacy names.
    result := result
      - 'correctAnswerId'
      - 'correctAnswers'
      - 'text_correct_answer_id'
      - 'text_correct_answers';
  elsif p_game_type = 'puzzle' then
    if result ->> 'puzzle_type' = 'wordle' then
      result := jsonb_set(
        result - 'puzzle_wordle_answer',
        '{puzzle_wordle_length}',
        to_jsonb(char_length(coalesce(result ->> 'puzzle_wordle_answer', ''))),
        true
      );
    elsif result ->> 'puzzle_type' = 'matching' then
      pairs := coalesce(result -> 'puzzle_matching_pairs', '[]'::jsonb);
      if jsonb_array_length(pairs) > 0 then
        for i in 0 .. jsonb_array_length(pairs) - 1 loop
          elem := pairs -> i;
          out_left := out_left || jsonb_build_array(jsonb_build_object(
            'id', elem ->> 'leftId',
            'text', elem ->> 'left'
          ));
          out_right := out_right || jsonb_build_array(jsonb_build_object(
            'id', elem ->> 'rightId',
            'text', elem ->> 'right'
          ));
        end loop;
      end if;
      result := (result - 'puzzle_matching_pairs') || jsonb_build_object(
        'puzzle_matching_left_items', out_left,
        'puzzle_matching_right_items', out_right
      );
    elsif result ->> 'puzzle_type' = 'crossword' then
      result := result - 'puzzle_crossword_words';
    end if;
  elsif p_game_type = 'music_bingo' then
    if coalesce(p_bingo_state, 'waiting') is distinct from 'bonus_revealed' then
      challenges := coalesce(result -> 'bonus_challenges', '[]'::jsonb);
      if jsonb_array_length(challenges) > 0 then
        for i in 0 .. jsonb_array_length(challenges) - 1 loop
          elem := challenges -> i;
          out_challenges := out_challenges || jsonb_build_array(elem - 'correctAnswerId');
        end loop;
      end if;
      result := jsonb_set(result, '{bonus_challenges}', out_challenges, true);
    end if;
  end if;
  return result;
end;
$$;

-- Internal serializer. It exposes guesses, solved item IDs, and crossword fill
-- state, never the Wordle answer, the unsolved matching map, or crossword
-- answers.
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
begin
  select g.config into v_config
  from public.games g
  where g.id = p_game_id and g.type = 'puzzle';

  if v_config is null then
    raise exception 'Puzzle not found.';
  end if;

  select p.* into v_progress
  from public.event_puzzle_progress p
  where p.event_id = p_event_id
    and p.team_id = p_team_id
    and p.game_id = p_game_id;

  if v_config ->> 'puzzle_type' = 'matching' and v_progress.team_id is not null then
    v_pairs := coalesce(v_config -> 'puzzle_matching_pairs', '[]'::jsonb);
    for v_pair in select value from jsonb_array_elements(v_pairs) loop
      if (v_pair ->> 'id') = any(v_progress.matched_pair_ids) then
        v_left_ids := v_left_ids || jsonb_build_array(v_pair ->> 'leftId');
        v_right_ids := v_right_ids || jsonb_build_array(v_pair ->> 'rightId');
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'puzzleType', v_config ->> 'puzzle_type',
    'attempts', coalesce(v_progress.attempts, 0),
    'wrongMatches', coalesce(v_progress.wrong_matches, 0),
    'guesses', coalesce(v_progress.wordle_guesses, '[]'::jsonb),
    'matchedLeftIds', v_left_ids,
    'matchedRightIds', v_right_ids,
    'filledCells', coalesce(v_progress.filled_cells, '{}'::jsonb),
    'failedFullChecks', coalesce(v_progress.failed_full_checks, 0),
    'solveSeconds', case
      when v_progress.completed_at is not null
      then floor(extract(epoch from v_progress.completed_at - v_progress.created_at))::integer
    end,
    'completed', v_progress.completed_at is not null,
    'pointsAwarded', v_progress.points_awarded
  );
end;
$$;

create or replace function public.update_crossword_fill(
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

  if jsonb_typeof(coalesce(p_cells, '{}'::jsonb)) <> 'object'
     or pg_column_size(coalesce(p_cells, '{}'::jsonb)) > 4096 then
    raise exception 'Invalid crossword fill payload.';
  end if;

  -- Row creation starts the solve timer.
  insert into public.event_puzzle_progress (event_id, team_id, game_id, puzzle_type)
  values (p_event_id, v_team_id, p_game_id, 'crossword')
  on conflict (event_id, team_id, game_id) do nothing;

  select p.* into v_progress
  from public.event_puzzle_progress p
  where p.event_id = p_event_id and p.team_id = v_team_id and p.game_id = p_game_id
  for update;

  if v_progress.completed_at is null then
    update public.event_puzzle_progress
    set filled_cells = coalesce(p_cells, '{}'::jsonb),
        updated_at = now()
    where event_id = p_event_id and team_id = v_team_id and game_id = p_game_id;
  end if;

  return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id);
end;
$$;

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
  v_word jsonb;
  v_answer text;
  v_row integer;
  v_col integer;
  v_correct boolean := true;
  v_i integer;
  v_key text;
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

  for v_word in
    select value from jsonb_array_elements(coalesce(v_config -> 'puzzle_crossword_words', '[]'::jsonb))
  loop
    v_answer := lower(coalesce(v_word ->> 'answer', ''));
    v_row := (v_word ->> 'row')::integer;
    v_col := (v_word ->> 'col')::integer;
    for v_i in 0 .. char_length(v_answer) - 1 loop
      if v_word ->> 'direction' = 'down' then
        v_key := (v_row + v_i) || '-' || v_col;
      else
        v_key := v_row || '-' || (v_col + v_i);
      end if;
      if lower(coalesce(p_cells ->> v_key, '')) <> substr(v_answer, v_i + 1, 1) then
        v_correct := false;
      end if;
    end loop;
  end loop;

  if v_correct then
    v_solve_seconds := floor(extract(epoch from now() - v_progress.created_at))::integer;
    v_awarded := public.puzzle_crossword_points(v_points, v_solve_seconds);

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
        failed_full_checks = v_progress.failed_full_checks + 1,
        updated_at = now()
    where event_id = p_event_id and team_id = v_team_id and game_id = p_game_id;
  end if;

  return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id)
    || jsonb_build_object('lastCheckCorrect', v_correct);
end;
$$;

revoke all on function public.update_crossword_fill(uuid, uuid, text, jsonb) from public;
grant execute on function public.update_crossword_fill(uuid, uuid, text, jsonb) to anon, authenticated;
revoke all on function public.validate_crossword_grid(uuid, uuid, text, jsonb) from public;
grant execute on function public.validate_crossword_grid(uuid, uuid, text, jsonb) to anon, authenticated;
revoke all on function public.puzzle_crossword_points(integer, numeric) from public;
