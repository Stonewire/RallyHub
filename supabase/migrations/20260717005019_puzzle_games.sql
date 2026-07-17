-- Puzzle game family: Wordle and Matching are playable Quest games. Crossword
-- remains a client-side Upcoming option and cannot be saved in this release.

alter table public.games drop constraint if exists games_type_check;
alter table public.games
  add constraint games_type_check
  check (type in ('photo', 'video', 'quiz', 'music_bingo', 'text', 'puzzle'));

-- Live clients load games through get_live_event_games(), which redacts private
-- answers. Direct anonymous table reads would bypass that redaction, so remove
-- the legacy grant/policy left by the original live-event implementation.
revoke select on public.games from anon;
drop policy if exists "games_anon_select_join_token" on public.games;

create table public.event_puzzle_progress (
  event_id uuid not null references public.events (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  puzzle_type text not null check (puzzle_type in ('wordle', 'matching')),
  attempts integer not null default 0 check (attempts >= 0),
  wrong_matches integer not null default 0 check (wrong_matches >= 0),
  wordle_guesses jsonb not null default '[]'::jsonb,
  matched_pair_ids text[] not null default '{}',
  completed_at timestamptz,
  points_awarded integer check (points_awarded is null or points_awarded >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, team_id, game_id)
);

create index event_puzzle_progress_game_idx
  on public.event_puzzle_progress (event_id, game_id, completed_at);

alter table public.event_puzzle_progress enable row level security;

create policy "event_puzzle_progress_org_select"
on public.event_puzzle_progress for select to authenticated
using ((select public.is_org_member_for_event(event_id)));

revoke all on public.event_puzzle_progress from anon, authenticated;
grant select on public.event_puzzle_progress to authenticated;

-- The live bundle may show the puzzle board, but never its solution. Matching
-- uses independent left/right item IDs so the participant cannot infer a pair
-- from the public config.
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

create or replace function public.puzzle_wordle_feedback(
  p_answer text,
  p_guess text
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_answer text[] := regexp_split_to_array(lower(p_answer), '');
  v_guess text[] := regexp_split_to_array(lower(p_guess), '');
  v_used boolean[] := array_fill(false, array[char_length(p_answer)]);
  v_feedback text[] := array_fill('absent'::text, array[char_length(p_answer)]);
  i integer;
  j integer;
begin
  if char_length(p_answer) <> char_length(p_guess) then
    raise exception 'Guess length does not match the answer.';
  end if;

  for i in 1 .. coalesce(array_length(v_answer, 1), 0) loop
    if v_guess[i] = v_answer[i] then
      v_feedback[i] := 'correct';
      v_used[i] := true;
    end if;
  end loop;

  for i in 1 .. coalesce(array_length(v_guess, 1), 0) loop
    if v_feedback[i] = 'correct' then
      continue;
    end if;
    for j in 1 .. coalesce(array_length(v_answer, 1), 0) loop
      if not v_used[j] and v_guess[i] = v_answer[j] then
        v_feedback[i] := 'present';
        v_used[j] := true;
        exit;
      end if;
    end loop;
  end loop;

  return to_jsonb(v_feedback);
end;
$$;

create or replace function public.puzzle_wordle_points(
  p_max_points integer,
  p_attempts integer
)
returns integer
language sql
immutable
set search_path = public
as $$
  select greatest(
    round(greatest(p_max_points, 0) * power(0.90, greatest(p_attempts, 1) - 1))::integer,
    ceil(greatest(p_max_points, 0) * 0.10)::integer
  );
$$;

create or replace function public.puzzle_matching_points(
  p_max_points integer,
  p_wrong_matches integer
)
returns integer
language sql
immutable
set search_path = public
as $$
  select greatest(
    round(greatest(p_max_points, 0) * (1 - greatest(p_wrong_matches, 0) * 0.05))::integer,
    ceil(greatest(p_max_points, 0) * 0.25)::integer
  );
$$;

-- Internal token lookup. The raw token exists only on the participant device;
-- the database stores the SHA-256 digest created by the existing team-claim RPC.
create or replace function public.puzzle_team_for_token(
  p_event_id uuid,
  p_team_token text
)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select a.team_id
  from public.inventory_team_access a
  join public.teams t on t.id = a.team_id and t.event_id = a.event_id
  where a.event_id = p_event_id
    and a.token_hash = digest(coalesce(p_team_token, ''), 'sha256')
    and t.status = 'active'
    and nullif(trim(t.name), '') is not null
  limit 1;
$$;

-- Internal serializer. It exposes guesses and individually solved item IDs,
-- never the Wordle answer or the unsolved matching map.
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
    'completed', v_progress.completed_at is not null,
    'pointsAwarded', v_progress.points_awarded
  );
end;
$$;

create or replace function public.get_team_puzzle_progress(
  p_event_id uuid,
  p_game_id uuid,
  p_team_token text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  if not public.live_join_token_matches_event(p_event_id) then
    raise exception 'Event access has expired. Reload the team page.';
  end if;

  v_team_id := public.puzzle_team_for_token(p_event_id, p_team_token);
  if v_team_id is null then
    raise exception 'This phone is not authorized for a team. Rejoin the event.';
  end if;

  if not exists (
    select 1 from public.event_games eg
    join public.games g on g.id = eg.game_id
    where eg.event_id = p_event_id and eg.game_id = p_game_id and g.type = 'puzzle'
  ) then
    raise exception 'This puzzle is not part of the event.';
  end if;

  return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id);
end;
$$;

-- Allow only the two tightly-scoped puzzle RPCs below to create an approved
-- puzzle submission and add its calculated score during an anonymous request.
create or replace function public.teams_guard_participant_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_inventory_deduction boolean :=
    coalesce(current_setting('rallyhub.inventory_score_deduction', true), '') = 'on'
    and NEW.score < OLD.score;
  v_puzzle_award boolean :=
    coalesce(current_setting('rallyhub.puzzle_score_award', true), '') = 'on'
    and NEW.score > OLD.score;
begin
  if auth.role() = 'anon' then
    if (NEW.score is distinct from OLD.score and not v_inventory_deduction and not v_puzzle_award)
       or NEW.color is distinct from OLD.color
       or NEW.slot_number is distinct from OLD.slot_number
       or NEW.event_id is distinct from OLD.event_id
    then
      raise exception 'Participants cannot modify protected team fields';
    end if;

    if NEW.status is distinct from OLD.status then
      if not (OLD.status = 'idle' and NEW.status = 'active') then
        raise exception 'Participants can only activate their team slot';
      end if;
    end if;
  end if;
  return NEW;
end;
$$;

create or replace function public.submissions_guard_participant_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_puzzle_award boolean :=
    coalesce(current_setting('rallyhub.puzzle_score_award', true), '') = 'on';
begin
  if auth.role() = 'anon' then
    if TG_OP = 'INSERT' then
      if v_puzzle_award
         and NEW.media_type = 'puzzle'
         and NEW.status = 'approved'
         and NEW.points_awarded is not null
         and NEW.points_awarded >= 0
      then
        return NEW;
      end if;
      if NEW.status is distinct from 'pending' then
        raise exception 'Submissions must start as pending';
      end if;
      if NEW.points_awarded is not null then
        raise exception 'Participants cannot set points';
      end if;
      return NEW;
    end if;

    if NEW.status is distinct from OLD.status then
      if not (OLD.status = 'pending' and NEW.status = 'cancelled') then
        raise exception 'Participants can only cancel pending submissions';
      end if;
    end if;
    if NEW.points_awarded is distinct from OLD.points_awarded then
      raise exception 'Participants cannot set points';
    end if;
    if NEW.team_id is distinct from OLD.team_id
       or NEW.event_id is distinct from OLD.event_id
       or NEW.game_id is distinct from OLD.game_id
    then
      raise exception 'Participants cannot reassign submissions';
    end if;
  end if;
  return NEW;
end;
$$;

create or replace function public.submit_wordle_guess(
  p_event_id uuid,
  p_game_id uuid,
  p_team_token text,
  p_guess text
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
  v_answer text;
  v_guess text := lower(trim(coalesce(p_guess, '')));
  v_points integer;
  v_event_status text;
  v_stage jsonb;
  v_submissions_open boolean;
  v_progress public.event_puzzle_progress%rowtype;
  v_feedback jsonb;
  v_completed boolean;
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

  if v_config is null or v_config ->> 'puzzle_type' <> 'wordle' then
    raise exception 'Wordle puzzle not found.';
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

  v_answer := lower(trim(coalesce(v_config ->> 'puzzle_wordle_answer', '')));
  if char_length(v_answer) not between 3 and 12 then
    raise exception 'This Wordle answer is not configured correctly.';
  end if;
  if char_length(v_guess) <> char_length(v_answer) then
    raise exception 'Enter a % letter word.', char_length(v_answer);
  end if;
  if v_guess ~ '[^[:alpha:]]' then
    raise exception 'Use letters only.';
  end if;

  insert into public.event_puzzle_progress (event_id, team_id, game_id, puzzle_type)
  values (p_event_id, v_team_id, p_game_id, 'wordle')
  on conflict (event_id, team_id, game_id) do nothing;

  select p.* into v_progress
  from public.event_puzzle_progress p
  where p.event_id = p_event_id and p.team_id = v_team_id and p.game_id = p_game_id
  for update;

  if v_progress.completed_at is not null then
    return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id);
  end if;

  v_feedback := public.puzzle_wordle_feedback(v_answer, v_guess);
  v_completed := v_guess = v_answer;
  v_progress.attempts := v_progress.attempts + 1;
  if v_completed then
    v_awarded := public.puzzle_wordle_points(v_points, v_progress.attempts);
  end if;

  update public.event_puzzle_progress
  set attempts = v_progress.attempts,
      wordle_guesses = wordle_guesses || jsonb_build_array(jsonb_build_object(
        'word', v_guess,
        'feedback', v_feedback
      )),
      completed_at = case when v_completed then now() else completed_at end,
      points_awarded = case when v_completed then v_awarded else points_awarded end,
      updated_at = now()
  where event_id = p_event_id and team_id = v_team_id and game_id = p_game_id;

  if v_completed then
    perform set_config('rallyhub.puzzle_score_award', 'on', true);
    insert into public.submissions (
      event_id, team_id, game_id, media_url, media_type, status, points_awarded
    ) values (
      p_event_id, v_team_id, p_game_id, 'wordle:' || v_progress.attempts,
      'puzzle', 'approved', v_awarded
    );
    update public.teams set score = score + v_awarded where id = v_team_id;
    perform set_config('rallyhub.puzzle_score_award', 'off', true);
  end if;

  return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id);
end;
$$;

create or replace function public.submit_matching_pair(
  p_event_id uuid,
  p_game_id uuid,
  p_team_token text,
  p_left_id text,
  p_right_id text
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
  v_pairs jsonb;
  v_points integer;
  v_event_status text;
  v_stage jsonb;
  v_submissions_open boolean;
  v_progress public.event_puzzle_progress%rowtype;
  v_left_pair_id text;
  v_right_pair_id text;
  v_correct boolean;
  v_total integer;
  v_awarded integer;
  v_payload jsonb;
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

  if v_config is null or v_config ->> 'puzzle_type' <> 'matching' then
    raise exception 'Matching puzzle not found.';
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

  v_pairs := coalesce(v_config -> 'puzzle_matching_pairs', '[]'::jsonb);
  v_total := jsonb_array_length(v_pairs);
  if v_total not between 2 and 12 then
    raise exception 'This Matching puzzle is not configured correctly.';
  end if;

  select elem ->> 'id' into v_left_pair_id
  from jsonb_array_elements(v_pairs) elem
  where elem ->> 'leftId' = p_left_id limit 1;
  select elem ->> 'id' into v_right_pair_id
  from jsonb_array_elements(v_pairs) elem
  where elem ->> 'rightId' = p_right_id limit 1;
  if v_left_pair_id is null or v_right_pair_id is null then
    raise exception 'That matching option is no longer available.';
  end if;

  insert into public.event_puzzle_progress (event_id, team_id, game_id, puzzle_type)
  values (p_event_id, v_team_id, p_game_id, 'matching')
  on conflict (event_id, team_id, game_id) do nothing;

  select p.* into v_progress
  from public.event_puzzle_progress p
  where p.event_id = p_event_id and p.team_id = v_team_id and p.game_id = p_game_id
  for update;

  if v_progress.completed_at is not null then
    return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id);
  end if;
  if v_left_pair_id = any(v_progress.matched_pair_ids)
     or v_right_pair_id = any(v_progress.matched_pair_ids)
  then
    return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id)
      || jsonb_build_object('lastMatchCorrect', true);
  end if;

  v_correct := v_left_pair_id = v_right_pair_id;
  v_progress.attempts := v_progress.attempts + 1;
  if v_correct then
    v_progress.matched_pair_ids := array_append(v_progress.matched_pair_ids, v_left_pair_id);
  else
    v_progress.wrong_matches := v_progress.wrong_matches + 1;
  end if;

  if cardinality(v_progress.matched_pair_ids) = v_total then
    v_awarded := public.puzzle_matching_points(v_points, v_progress.wrong_matches);
  end if;

  update public.event_puzzle_progress
  set attempts = v_progress.attempts,
      wrong_matches = v_progress.wrong_matches,
      matched_pair_ids = v_progress.matched_pair_ids,
      completed_at = case when v_awarded is not null then now() else completed_at end,
      points_awarded = coalesce(v_awarded, points_awarded),
      updated_at = now()
  where event_id = p_event_id and team_id = v_team_id and game_id = p_game_id;

  if v_awarded is not null then
    perform set_config('rallyhub.puzzle_score_award', 'on', true);
    insert into public.submissions (
      event_id, team_id, game_id, media_url, media_type, status, points_awarded
    ) values (
      p_event_id, v_team_id, p_game_id,
      'matching:' || v_progress.attempts, 'puzzle', 'approved', v_awarded
    );
    update public.teams set score = score + v_awarded where id = v_team_id;
    perform set_config('rallyhub.puzzle_score_award', 'off', true);
  end if;

  v_payload := public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id);
  return v_payload || jsonb_build_object('lastMatchCorrect', v_correct);
end;
$$;

-- Internal helpers are not API endpoints.
revoke all on function public.puzzle_team_for_token(uuid, text)
  from public, anon, authenticated;
revoke all on function public.puzzle_progress_payload(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.puzzle_wordle_feedback(text, text)
  from public, anon, authenticated;
revoke all on function public.puzzle_wordle_points(integer, integer)
  from public, anon, authenticated;
revoke all on function public.puzzle_matching_points(integer, integer)
  from public, anon, authenticated;

revoke all on function public.get_team_puzzle_progress(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.submit_wordle_guess(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.submit_matching_pair(uuid, uuid, text, text, text)
  from public, anon, authenticated;

grant execute on function public.get_team_puzzle_progress(uuid, uuid, text)
  to anon, service_role;
grant execute on function public.submit_wordle_guess(uuid, uuid, text, text)
  to anon, service_role;
grant execute on function public.submit_matching_pair(uuid, uuid, text, text, text)
  to anon, service_role;

comment on table public.event_puzzle_progress is
  'Server-authoritative per-team Wordle/Matching attempts, progress, and one-time score.';
comment on function public.submit_wordle_guess(uuid, uuid, text, text) is
  'Validates a private team token and current Quest stage, records a Wordle guess, and scores completion once.';
comment on function public.submit_matching_pair(uuid, uuid, text, text, text) is
  'Validates a private team token and current Quest stage, records one matching attempt, and scores completion once.';
