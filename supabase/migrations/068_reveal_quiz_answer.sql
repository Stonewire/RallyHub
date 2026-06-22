-- ROOT CAUSE of quiz reveal never working: get_live_event_games redacts
-- correctAnswerId for EVERYONE (including the facilitator). So when the
-- facilitator wrote quiz_correct_answer_id = question.correctAnswerId from its
-- cached (redacted) bundle, it wrote NULL. Players then sit on "revealing…"
-- forever because the correct id never arrives.
--
-- Fix: reveal server-side, reading the unredacted answer — mirrors
-- score_current_quiz_question exactly (same authz, same config lookup).

create or replace function public.reveal_quiz_answer(
  p_event_id   uuid,
  p_game_id    uuid,
  p_question_id text
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_correct text;
begin
  if not public.is_facilitator_for_event(p_event_id) then
    raise exception 'Facilitator access required';
  end if;

  select elem ->> 'correctAnswerId'
  into v_correct
  from public.games g
  cross join lateral jsonb_array_elements(
    coalesce(g.config -> 'questions', '[]'::jsonb)
  ) elem
  where g.id = p_game_id
    and elem ->> 'id' = p_question_id
  limit 1;

  update public.event_state
  set quiz_state            = 'revealed',
      quiz_timer_running    = false,
      quiz_correct_answer_id = v_correct
  where event_id = p_event_id;

  return v_correct;
end;
$function$;

grant execute on function public.reveal_quiz_answer(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
