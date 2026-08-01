-- Text games gain the design's Auto approval mode.
--
-- Before this, EVERY text submission was inserted as 'pending' and waited for
-- a facilitator, regardless of settings. There was no automatic path at all,
-- so this adds a capability rather than untangling an existing one. It is
-- opt-in per game via config.text_approval_mode = 'auto'; absent or 'review'
-- keeps the old behaviour exactly, so every game that exists today is
-- unaffected.
--
-- Scoring mirrors the quiz path: a match awards points_static, a miss awards 0
-- and is still marked approved, so a team is never left waiting on a decision
-- that will not come.
--
-- Two things this got wrong first time, both caught by testing:
--
-- 1. Trigger ORDER. Postgres fires same-timing triggers alphabetically, and
--    'auto_approve_text_submission' sorts before
--    'submissions_guard_participant_write', which raises 'Participants cannot
--    set points' when NEW.points_awarded is set. Setting points first made the
--    guard reject every text submission. Hence the zz_ prefix: the guard sees
--    the participant's insert exactly as before, and the award is applied only
--    after it has passed.
--
-- 2. increment_team_score requires auth.uid() AND facilitator access, because
--    it is the RPC facilitators call and that guard stops a participant
--    awarding themselves points. A submitting participant has neither, so
--    calling it raised 'Authentication required'. The score is updated
--    directly instead, which is safe here in a way the RPC is not: the award
--    is computed server-side from the game's own config and points_static,
--    never from anything the participant sends. The submitted text is only
--    ever compared, never trusted as a value.
--
-- Verified with real inserts: auto + correct approved at 25 with team score 25,
-- auto + wrong approved at 0 with score unchanged, and a review-mode game left
-- pending with null points.
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

  NEW.status := 'approved';
  NEW.points_awarded := v_awarded;

  if v_awarded > 0 then
    update public.teams set score = score + v_awarded where id = NEW.team_id;
  end if;

  return NEW;
end;
$$;

drop trigger if exists auto_approve_text_submission on public.submissions;
drop trigger if exists zz_auto_approve_text_submission on public.submissions;
create trigger zz_auto_approve_text_submission
  before insert on public.submissions
  for each row
  execute function public.auto_approve_text_submission();
