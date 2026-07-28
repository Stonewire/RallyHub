-- SEC-TEAM: participant submission writes must prove team ownership.
--
-- Every anonymous participant in an event shares one join token, so the join
-- token can scope a request to an event but cannot prove the caller owns the
-- team_id it writes. The private per-device team token (minted at team claim
-- into inventory_team_access, raw value only on the phone, SHA-256 digest in
-- the database) closes that gap: the client now sends it as an x-team-token
-- header, and the submission write guard verifies the digest against the
-- submission's team.
--
-- DEPLOYMENT ORDER (critical): the client that attaches the x-team-token
-- header MUST be live in production BEFORE this migration is applied,
-- otherwise in-flight events reject every legitimate participant write.
-- Do not apply this migration ahead of the release that contains it.
--
-- Compatibility: teams claimed before the inventory token existed have no
-- inventory_team_access row. For exactly those teams the guard degrades to
-- the previous event-scoped behaviour instead of locking players out. Any
-- team claimed since V2.13.0 has a token row and is fully enforced.

create or replace function public.current_live_team_token()
returns text
language sql
stable
as $$
  select nullif(
    trim((coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-team-token')),
    ''
  );
$$;

create or replace function public.live_team_token_matches(
  p_event_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.inventory_team_access a
    where a.event_id = p_event_id
      and a.team_id = p_team_id
      and a.token_hash = digest(coalesce(public.current_live_team_token(), ''), 'sha256')
  );
$$;

create or replace function public.team_has_private_token(
  p_event_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.inventory_team_access a
    where a.event_id = p_event_id
      and a.team_id = p_team_id
  );
$$;

revoke all on function public.current_live_team_token() from public, anon, authenticated;
revoke all on function public.live_team_token_matches(uuid, uuid) from public, anon, authenticated;
revoke all on function public.team_has_private_token(uuid, uuid) from public, anon, authenticated;

-- Full recreation of the participant write guard. This body is a superset of
-- the version deployed by the puzzle migrations (20260717005019): the puzzle
-- score-award bypass is preserved exactly (those RPCs validate the team token
-- themselves, as an argument), and team ownership is now enforced for every
-- other anonymous insert and update.
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
      if public.team_has_private_token(NEW.event_id, NEW.team_id)
         and not public.live_team_token_matches(NEW.event_id, NEW.team_id)
      then
        raise exception 'This phone is not authorized for that team. Rejoin the event.';
      end if;
      if NEW.status is distinct from 'pending' then
        raise exception 'Submissions must start as pending';
      end if;
      if NEW.points_awarded is not null then
        raise exception 'Participants cannot set points';
      end if;
      return NEW;
    end if;

    if public.team_has_private_token(OLD.event_id, OLD.team_id)
       and not public.live_team_token_matches(OLD.event_id, OLD.team_id)
    then
      raise exception 'This phone is not authorized for that team. Rejoin the event.';
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

comment on function public.submissions_guard_participant_write() is
  'Participant write rules: pending-only inserts, cancel-only updates, no point or reassignment edits, puzzle-RPC score bypass, and team ownership proven by the private x-team-token header when the team has one.';
