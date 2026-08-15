-- Full-review finding C8: get_offline_event_package shipped answer keys for
-- EVERY text game, but auto_approve_text_submission only auto-scores when
-- coalesce(text_approval_mode,'review') = 'auto' — review is the default. A
-- manually-reviewed text game's answers have no offline-scoring purpose on the
-- device and must stay server-side (short natural-language answers are
-- dictionary-attackable even as hashes). Ship keys only for auto games.
-- Puzzle branch unchanged (puzzles always auto-score).
create or replace function public.get_offline_event_package(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  authed boolean;
  result jsonb := '{}'::jsonb;
  r record;
  cfg jsonb;
  entry jsonb;
  hashes jsonb;
  ans text;
begin
  select exists (
    select 1
    from public.inventory_team_access a
    join public.events e on e.id = a.event_id
    where a.event_id = p_event_id
      and e.status in ('active', 'ready', 'demo')
      and a.token_hash = digest(coalesce(public.current_live_team_token(), ''), 'sha256')
  )
  into authed;

  if not authed then
    return null;
  end if;

  for r in
    select g.id, g.type, g.config
    from public.event_games eg
    join public.games g on g.id = eg.game_id
    where eg.event_id = p_event_id
      and g.type in ('text', 'puzzle')
  loop
    cfg := coalesce(r.config, '{}'::jsonb);
    entry := '{}'::jsonb;

    if r.type = 'text' then
      -- Only auto-approved games score on the device; a review-mode game's
      -- answers never leave the server. Same default as the trigger.
      if coalesce(cfg ->> 'text_approval_mode', 'review') = 'auto' then
        if (cfg ->> 'text_answer_mode') = 'choose_answer' then
          if cfg ? 'text_correct_answer_id' then
            entry := jsonb_build_object('text_correct_answer_id', cfg -> 'text_correct_answer_id');
          end if;
        else
          hashes := '[]'::jsonb;
          for ans in
            select jsonb_array_elements_text(coalesce(cfg -> 'text_correct_answers', '[]'::jsonb))
          loop
            if btrim(ans) = '' then
              continue;
            end if;
            hashes := hashes || to_jsonb(encode(digest(btrim(ans), 'sha256'), 'hex'));
          end loop;
          if jsonb_array_length(hashes) > 0 then
            entry := jsonb_build_object('text_correct_answer_hashes', hashes);
          end if;
        end if;
      end if;

    elsif r.type = 'puzzle' then
      if (cfg ->> 'puzzle_type') = 'wordle' then
        entry := jsonb_build_object('puzzle_wordle_answer', cfg -> 'puzzle_wordle_answer');
      elsif (cfg ->> 'puzzle_type') = 'matching' then
        entry := jsonb_build_object(
          'puzzle_matching_pairs', coalesce(cfg -> 'puzzle_matching_pairs', '[]'::jsonb)
        );
      elsif (cfg ->> 'puzzle_type') = 'crossword' then
        entry := jsonb_build_object(
          'puzzle_crossword_words', coalesce(cfg -> 'puzzle_crossword_words', '[]'::jsonb)
        );
      end if;
    end if;

    if entry <> '{}'::jsonb then
      result := jsonb_set(result, array[r.id::text], entry, true);
    end if;
  end loop;

  return jsonb_build_object('answerKeys', result);
end;
$function$;

grant execute on function public.get_offline_event_package(uuid) to anon, authenticated;
