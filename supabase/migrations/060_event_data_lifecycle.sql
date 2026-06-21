-- Event data lifecycle: soft-delete with metadata preservation + 6-month auto-purge.
--
-- When a client deletes an archived event the row is NOT removed from the DB.
-- Instead, all bulky live data (submissions, teams, bingo, chat) is wiped and
-- wiped_at is set. The event row stays so payment history is intact.
--
-- pg_cron runs purge_old_event_data() daily to wipe DB rows for events whose
-- activation was >6 months ago. Storage file cleanup (media_url / photo_url)
-- is handled in application code before calling these RPCs.

-- ── Column ─────────────────────────────────────────────────────────────────
alter table public.events
  add column if not exists wiped_at timestamptz default null;

-- ── RPC: wipe_event_data ────────────────────────────────────────────────────
-- Deletes all live / bulky data for an archived event and marks it wiped.
-- Only archived events can be wiped (active/demo events are never "deleted").
-- Called from the client after storage files have already been removed.

create or replace function public.wipe_event_data(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select e.status, e.organization_id
  into v_status, v_org_id
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found';
  end if;

  -- Only super_admin can wipe any org's event; client_admin can wipe their own
  if v_org_id is distinct from public.user_organization_id()
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  then
    raise exception 'Not authorized to delete this event';
  end if;

  if v_status not in ('archived') then
    raise exception 'Only archived events can be deleted';
  end if;

  -- Delete bulky live data
  delete from public.event_activity_log where event_id = p_event_id;
  delete from public.chat_messages       where event_id = p_event_id;
  delete from public.submissions         where event_id = p_event_id;

  delete from public.bingo_team_cards
  where run_id in (select id from public.bingo_runs where event_id = p_event_id);
  delete from public.bingo_runs  where event_id = p_event_id;
  delete from public.teams       where event_id = p_event_id;
  delete from public.event_state where event_id = p_event_id;
  delete from public.event_games where event_id = p_event_id;

  -- Mark as wiped — metadata (name, event_date, invoiced_at, invoice_paid) stays
  update public.events
  set wiped_at = now()
  where id = p_event_id;
end;
$$;

grant execute on function public.wipe_event_data(uuid) to authenticated;

comment on function public.wipe_event_data(uuid) is
  'Wipes all live data for an archived event while keeping the event row for payment history.';

-- ── RPC: purge_old_event_data ───────────────────────────────────────────────
-- Wipes DB rows for events activated more than 6 months ago.
-- Runs as the service role (pg_cron context) so no auth.uid() check.
-- Storage file cleanup is NOT done here — it must be handled separately
-- (edge function or manual Dashboard cleanup).

create or replace function public.purge_old_event_data()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_count    integer := 0;
begin
  for v_event_id in
    select id
    from public.events
    where invoiced_at is not null
      and invoiced_at < now() - interval '6 months'
      and wiped_at is null
  loop
    delete from public.event_activity_log where event_id = v_event_id;
    delete from public.chat_messages       where event_id = v_event_id;
    delete from public.submissions         where event_id = v_event_id;

    delete from public.bingo_team_cards
    where run_id in (select id from public.bingo_runs where event_id = v_event_id);
    delete from public.bingo_runs  where event_id = v_event_id;
    delete from public.teams       where event_id = v_event_id;
    delete from public.event_state where event_id = v_event_id;
    delete from public.event_games where event_id = v_event_id;

    update public.events
    set wiped_at = now()
    where id = v_event_id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Only super_admin / service role should call this directly
revoke all on function public.purge_old_event_data() from public, anon, authenticated;

comment on function public.purge_old_event_data() is
  'Auto-purges DB rows for events activated >6 months ago. Called by pg_cron. Returns count of events purged.';

-- ── pg_cron schedule ────────────────────────────────────────────────────────
-- Runs at 02:00 UTC every day. Requires pg_cron extension (enabled in Supabase).
-- If pg_cron is not available this statement will fail — comment it out and
-- trigger the function manually or via an edge function + Supabase cron job.

select cron.schedule(
  'purge-old-event-data',
  '0 2 * * *',
  'select public.purge_old_event_data()'
);
