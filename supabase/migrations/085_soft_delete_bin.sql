-- Recycle bin: soft-delete games and events, listed in a Bin tab for 30
-- days (restorable or openable), then auto-purged by pg_cron.
--
-- Distinct from events.wiped_at, a separate pre-existing 6-month
-- invoiced-event data-retention cutoff (purge_old_event_data) -- untouched.
--
-- Soft-deleting an event no longer wipes its data immediately (the old
-- Delete button called wipe_event_data on click, destroying live data on
-- the spot). Now Delete just hides the row; the destructive cleanup only
-- runs once the 30-day window lapses, reusing wipe_event_data's existing
-- invoiced/non-invoiced split so paid events still keep their row for
-- payment history.
--
-- ponytail: like the existing 6-month purge_old_event_data, these purge
-- functions don't touch Storage (cover/solution/submission files) -- pg_cron
-- has no Storage API access. Same accepted gap as 060_event_data_lifecycle;
-- pair with an edge function if orphaned storage cost becomes a problem.

alter table public.games  add column if not exists deleted_at timestamptz;
alter table public.events add column if not exists deleted_at timestamptz;

create index if not exists games_deleted_at_idx
  on public.games (deleted_at) where deleted_at is not null;
create index if not exists events_deleted_at_idx
  on public.events (deleted_at) where deleted_at is not null;

-- ── purge_deleted_games ──────────────────────────────────────────────────
create or replace function public.purge_deleted_games()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with purged as (
    delete from public.games
    where deleted_at is not null
      and deleted_at < now() - interval '30 days'
    returning id
  )
  select count(*) into v_count from purged;
  return v_count;
end;
$$;

revoke all on function public.purge_deleted_games() from public, anon, authenticated;

comment on function public.purge_deleted_games() is
  'Hard-deletes games trashed more than 30 days ago. Called by pg_cron.';

-- ── purge_deleted_events ─────────────────────────────────────────────────
create or replace function public.purge_deleted_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_count integer := 0;
begin
  for v_event in
    select id, invoiced_at
    from public.events
    where deleted_at is not null
      and deleted_at < now() - interval '30 days'
  loop
    delete from public.event_activity_log where event_id = v_event.id;
    delete from public.chat_messages       where event_id = v_event.id;
    delete from public.submissions         where event_id = v_event.id;
    delete from public.bingo_team_cards
      where run_id in (select id from public.bingo_runs where event_id = v_event.id);
    delete from public.bingo_runs  where event_id = v_event.id;
    delete from public.teams       where event_id = v_event.id;
    delete from public.event_state where event_id = v_event.id;
    delete from public.event_games where event_id = v_event.id;

    if v_event.invoiced_at is not null then
      -- Payment history: keep the row (already hidden via deleted_at).
      update public.events set wiped_at = now() where id = v_event.id;
    else
      delete from public.events where id = v_event.id;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.purge_deleted_events() from public, anon, authenticated;

comment on function public.purge_deleted_events() is
  'Wipes/deletes events trashed more than 30 days ago (invoiced events keep their row for payment history). Called by pg_cron.';

select cron.schedule('purge-deleted-games', '0 3 * * *', 'select public.purge_deleted_games()');
select cron.schedule('purge-deleted-events', '0 3 * * *', 'select public.purge_deleted_events()');
