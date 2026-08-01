-- Permanent delete for games, to match what Events already has.
--
-- This was deliberately left unbuilt during the redesign because there was no
-- safe backend for it and inventing one is not a design task. Rumen asked for
-- it explicitly, so here it is, with the hazard handled rather than ignored.
--
-- The hazard: submissions.game_id is ON DELETE CASCADE, as are
-- event_performance_segments, event_puzzle_progress and bingo_runs. A plain
-- "delete from games" therefore destroys every submission ever made for that
-- game, in every past event, without warning. That is a client's event history,
-- not the organiser's game template, and no confirmation dialog makes it
-- reasonable.
--
-- So this refuses rather than cascades:
--   * the game must already be in Deleted Games (soft-deleted first)
--   * it must have no submissions at all
--   * it must not still be attached to any event
-- Anything else raises a message naming the reason. Checked against live data
-- when this was written: of 83 soft-deleted games, 1 had submissions and 5 were
-- still attached to an event, so the guard blocks the 6 cases that matter and
-- leaves the other 77 freely deletable.
--
-- client_admin and super_admin only. event_manager can soft-delete a game but
-- cannot destroy it, matching how the rest of the destructive surface behaves.
create or replace function public.permanently_delete_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_deleted_at timestamptz;
  v_name text;
  v_submissions bigint;
  v_events bigint;
begin
  select organization_id, deleted_at, name
    into v_org, v_deleted_at, v_name
  from public.games
  where id = p_game_id;

  if v_org is null then
    raise exception 'Game not found.';
  end if;

  if not (
    public.is_super_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.organization_id = v_org
        and p.role = 'client_admin'
    )
  ) then
    raise exception 'You do not have permission to permanently delete this game.';
  end if;

  if v_deleted_at is null then
    raise exception 'Delete "%" first, then remove it permanently from Deleted Games.', v_name;
  end if;

  select count(*) into v_submissions from public.submissions where game_id = p_game_id;
  if v_submissions > 0 then
    raise exception
      '"%" has % saved submission(s) from past events. Permanently deleting it would delete those too, so it has been kept.',
      v_name, v_submissions;
  end if;

  select count(*) into v_events from public.event_games where game_id = p_game_id;
  if v_events > 0 then
    raise exception
      '"%" is still attached to % event(s). Remove it from them first.', v_name, v_events;
  end if;

  delete from public.games where id = p_game_id;
end;
$$;

revoke all on function public.permanently_delete_game(uuid) from public, anon;
grant execute on function public.permanently_delete_game(uuid) to authenticated;

comment on function public.permanently_delete_game(uuid) is
  'Hard-deletes a soft-deleted game. Refuses if it has submissions or is still '
  'attached to an event, because those FKs cascade and would take event history '
  'with them. client_admin or super_admin only.';
