-- Security fix (audit 2026-08-11, finding 3): a participant could rename ANY
-- team and swap ANY team's photo in their event, because teams_guard_participant
-- _update protected score/color/slot/status/event_id but NOT name or photo_url,
-- and the anon UPDATE policy (teams_anon_update_claim) only checks the shared,
-- event-wide join token, never per-team ownership. Net effect: a joker in the
-- event could put a rude name or an offensive image on the live display screen.
--
-- Fix: reuse the existing per-team ownership check (team_has_private_token /
-- live_team_token_matches, already used by submissions_guard_participant_write
-- and already granted to anon) to gate name/photo edits. Once a team has been
-- claimed (has a private token), only the device holding the matching
-- x-team-token may change that team's name or photo. Unclaimed teams have no
-- token yet, so the initial naming/photo at claim time still works untouched.
--
-- Everything else in the guard is preserved verbatim from the previous version
-- (20260808120000_text_auto_award_guard.sql): the score/color/slot/status/
-- event_id protections and the inventory/puzzle/text score-award bypass markers.

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

    -- Team identity is owner-only. A claimed team (one that has a private
    -- token) may only have its name/photo changed by the device that proves
    -- ownership via the x-team-token header. Unclaimed teams have no token,
    -- so naming a fresh slot at claim time is unaffected.
    if (NEW.name is distinct from OLD.name
        or NEW.photo_url is distinct from OLD.photo_url)
       and public.team_has_private_token(OLD.event_id, OLD.id)
       and not public.live_team_token_matches(OLD.event_id, OLD.id)
    then
      raise exception 'This phone is not authorized for that team. Rejoin the event.';
    end if;
  end if;
  return NEW;
end;
$$;

comment on function public.teams_guard_participant_update() is
  'Participant team-update rules: no score/color/slot/event_id edits (bar the '
  'inventory/puzzle/text score-award markers), status only idle->active, and '
  'name/photo edits only by the team-owning device (x-team-token) once a team '
  'has been claimed.';
