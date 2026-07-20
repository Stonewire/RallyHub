-- Crossword hint rework: reveal exactly one letter per use (previously
-- revealed one letter in every unsolved word at once, which could light up
-- many cells in a single press). Prefers a cell shared by two unsolved
-- crossing words so one hint helps both; otherwise falls back to any
-- unsolved word's first wrong cell. Deterministic tie-break: lowest
-- "row-col" key text (arbitrary but stable).

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
  v_candidates jsonb := '{}'::jsonb;
  v_counts jsonb := '{}'::jsonb;
  v_pick text;
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
      if lower(coalesce(v_filled ->> v_key, '')) <> substr(v_answer, v_i + 1, 1) then
        if v_candidates ? v_key then
          v_counts := jsonb_set(v_counts, array[v_key],
            to_jsonb(coalesce((v_counts ->> v_key)::integer, 1) + 1));
        else
          v_candidates := v_candidates || jsonb_build_object(v_key, upper(substr(v_answer, v_i + 1, 1)));
          v_counts := v_counts || jsonb_build_object(v_key, 1);
        end if;
      end if;
    end loop;
  end loop;

  -- Prefer a cell shared by two or more unsolved crossing words.
  select key into v_pick
  from jsonb_each_text(v_counts) as t(key, val)
  where val::integer >= 2
  order by key
  limit 1;

  -- Otherwise any single unsolved word's first wrong cell (deterministic).
  if v_pick is null then
    select key into v_pick from jsonb_each_text(v_candidates) as t(key, val) order by key limit 1;
  end if;

  -- Nothing left to reveal (e.g. everything already correct pending the
  -- next check) - don't burn a hint for no effect.
  if v_pick is not null then
    v_reveals := jsonb_build_object(v_pick, v_candidates ->> v_pick);
    update public.event_puzzle_progress
    set hints_used = v_progress.hints_used + 1,
        revealed_cells = coalesce(revealed_cells, '{}'::jsonb) || v_reveals,
        filled_cells = v_filled || v_reveals,
        updated_at = now()
    where event_id = p_event_id and team_id = v_team_id and game_id = p_game_id;
  end if;

  return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id);
end;
$$;
