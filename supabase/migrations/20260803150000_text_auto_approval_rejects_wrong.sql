-- Auto-approved text answers: reject a wrong one instead of approving it.
--
-- auto_approve_text_submission already worked out whether the answer matched
-- and awarded points accordingly, but then set status to 'approved' for every
-- submission regardless. A team that answered wrongly saw "Approved" on their
-- device with zero points, which reads as a scoring bug rather than a wrong
-- answer, and the facilitator had nothing to review because the row was
-- already resolved.
--
-- Only the status line changes. Matching, points and the team score update are
-- exactly as they were.

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
    -- Exact match, matching what the editor tells the organiser: case and
    -- symbols must match. Only surrounding whitespace is forgiven, since a
    -- trailing space is a typing artefact rather than a different answer.
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

  -- The whole point of automatic marking: a wrong answer is rejected, not
  -- approved for nothing.
  NEW.status := case when v_matched then 'approved' else 'rejected' end;
  NEW.points_awarded := v_awarded;

  if v_awarded > 0 then
    update public.teams set score = score + v_awarded where id = NEW.team_id;
  end if;

  return NEW;
end;
$$;
