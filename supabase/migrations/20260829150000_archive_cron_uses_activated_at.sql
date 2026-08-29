-- LIVE-EVENT FIX: the auto-archive cron could kill a recurring event's second run.
--
-- archive_stale_active_events (029) archived any active event whose invoiced_at
-- was more than 12 hours old. restart_recurring_event deliberately keeps
-- invoiced_at (20260829090000:185-186), and create_event_activation_invoice
-- only stamps it when it is null (`coalesce(invoiced_at, now())`), so from run 2
-- onwards invoiced_at is frozen at run 1's timestamp. A recurring event whose
-- first run was more than 12 hours earlier was therefore eligible the instant it
-- went active again, and the cron (every 15 minutes) archived it mid-event.
--
-- Archiving a live event is not cosmetic: bootstrap_live_event_access only mints
-- join tokens for status active/ready/demo, so every phone that joins late or
-- reloads is locked out while devices already holding a token keep playing. A
-- silent, partial failure in the middle of a live event.
--
-- activated_at is the right column for "12 hours since this run went live": the
-- activation trigger stamps it on every ready -> active transition and the
-- restart clears it, so it is per-run where invoiced_at is per-event. Legacy
-- rows that were activated before the trigger existed have no activated_at, so
-- coalesce back to invoiced_at and their behaviour is unchanged.
create or replace function public.archive_stale_active_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_archived integer;
begin
  update public.events
  set status = 'archived'
  where status = 'active'
    and coalesce(activated_at, invoiced_at) is not null
    and coalesce(activated_at, invoiced_at) <= now() - interval '12 hours';

  get diagnostics v_archived = row_count;
  return v_archived;
end;
$$;

comment on function public.archive_stale_active_events() is
  'Archives events left active 12h after THIS run went live. Keys off activated_at (per run, cleared by restart_recurring_event) and falls back to invoiced_at for legacy rows activated before the activation trigger existed.';
