-- Strip solution_video_url from every live payload, regardless of game type.
--
-- Done unconditionally rather than as a photo/video branch: a worked answer is
-- never player-facing for any type, and a type-specific branch would silently
-- leak the field the day another game type gains a solution video.
--
-- Only the tail of the function changes; every existing per-type branch is
-- reproduced verbatim. Verified after applying that video and photo both strip
-- it, that example_video_url (which IS player-facing) survives, and that the
-- existing text and wordle redaction still behave, including deriving
-- puzzle_wordle_length without the answer.
create or replace function public.redact_game_config_for_live(
  p_config jsonb, p_game_type text, p_quiz_state text,
  p_current_question_index integer, p_bingo_state text
)
returns jsonb
language plpgsql
immutable
set search_path to 'public'
as $function$
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

  -- Applies to every type, including ones added later.
  result := result - 'solution_video_url';

  return result;
end;
$function$;
