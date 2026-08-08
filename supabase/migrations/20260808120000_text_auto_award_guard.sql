-- Auto-approved text answers scored zero and errored for CORRECT answers.
--
-- auto_approve_text_submission (security definer, BEFORE INSERT on
-- submissions) updates teams.score when a correct auto-marked answer comes
-- in. That update fires teams_guard_participant_update, which blocks any
-- anon score change unless a private marker authorises it. Inventory
-- deductions and puzzle awards have markers; text awards never got one, so a
-- CORRECT answer raised "Participants cannot modify protected team fields"
-- (P0001) and the whole submission insert failed, while wrong answers (no
-- score change) sailed through. This is the "Triangle pieces" failure from
-- the 7 Aug event and CF3-10 from Rumen's 8 Aug test pass.
--
-- Fix: a rallyhub.text_score_award marker, set only inside
-- auto_approve_text_submission around its own score update, accepted by the
-- guard only for score increases. Everything else stays blocked.

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
  v_text_award boolean :=
    coalesce(current_setting('rallyhub.text_score_award', true), '') = 'on'
    and NEW.score > OLD.score;
begin
  if auth.role() = 'anon' then
    if (NEW.score is distinct from OLD.score
        and not v_inventory_deduction
        and not v_puzzle_award
        and not v_text_award)
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

create or replace function public.auto_approve_text_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config jsonb;
  v_points integer;
  v_awarded integer := 0;
  v_matched boolean := false;
begin
  if NEW.media_type is distinct from 'text' or NEW.status is distinct from 'pending' then
    return NEW;
  end if;

  select g.config, coalesce(g.points_static, 0)
  into v_config, v_points
  from public.games g
  where g.id = NEW.game_id;

  if coalesce(v_config ->> 'text_approval_mode', 'review') <> 'auto' then
    return NEW;
  end if;

  if coalesce(v_config ->> 'text_answer_mode', 'type_text') = 'choose_answer' then
    v_matched := NEW.media_url is not distinct from (v_config ->> 'text_correct_answer_id');
  else
    v_matched := exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(v_config -> 'text_correct_answers', '[]'::jsonb)
      ) ans
      where btrim(ans) = btrim(coalesce(NEW.media_url, ''))
        and btrim(ans) <> ''
    );
  end if;

  v_awarded := case when v_matched then v_points else 0 end;

  NEW.status := case when v_matched then 'approved' else 'rejected' end;
  NEW.points_awarded := v_awarded;

  if v_awarded > 0 then
    -- Marker read by teams_guard_participant_update; reset straight after so
    -- nothing else in this transaction inherits the permission.
    perform set_config('rallyhub.text_score_award', 'on', true);
    update public.teams set score = score + v_awarded where id = NEW.team_id;
    perform set_config('rallyhub.text_score_award', '', true);
  end if;

  return NEW;
end;
$$;
