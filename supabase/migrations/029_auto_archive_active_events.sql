-- Auto-archive active events 12+ hours after activation (invoiced_at).
-- Runs every 15 minutes via pg_cron when the extension is enabled.

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
    and invoiced_at is not null
    and invoiced_at <= now() - interval '12 hours';

  get diagnostics v_archived = row_count;
  return v_archived;
end;
$$;

comment on function public.archive_stale_active_events() is
  'Moves active events to archived when invoiced_at is 12+ hours ago. Does not touch invoices.';

revoke all on function public.archive_stale_active_events() from public;
grant execute on function public.archive_stale_active_events() to postgres;
grant execute on function public.archive_stale_active_events() to service_role;

-- Schedule with pg_cron (Supabase Pro+ / self-hosted with pg_cron enabled).
do $schedule$
declare
  v_job_id bigint;
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    raise notice
      'pg_cron extension not found. Schedule public.archive_stale_active_events() manually '
      '(see migration comments) or use a Supabase scheduled Edge Function.';
    return;
  end if;

  select jobid into v_job_id
  from cron.job
  where jobname = 'archive-stale-active-events'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'archive-stale-active-events',
    '*/15 * * * *',
    $cmd$select public.archive_stale_active_events()$cmd$
  );

  raise notice 'Scheduled pg_cron job archive-stale-active-events every 15 minutes.';
exception
  when undefined_table then
    raise notice
      'pg_cron schema unavailable. Enable pg_cron in Supabase Dashboard → Database → Extensions, '
      'then re-run: select cron.schedule(''archive-stale-active-events'', ''*/15 * * * *'', '
      '''select public.archive_stale_active_events()'');';
  when undefined_function then
    raise notice
      'pg_cron functions unavailable. Enable the pg_cron extension and schedule manually.';
end;
$schedule$;

-- ─── Verification (run in SQL editor) ───
-- Manual run (returns number of events archived this call):
--   select public.archive_stale_active_events();
--
-- Confirm pg_cron job exists:
--   select jobid, jobname, schedule, command, active from cron.job
--   where jobname = 'archive-stale-active-events';
--
-- Recent job runs (if cron.job_run_details exists):
--   select * from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'archive-stale-active-events')
--   order by start_time desc limit 10;
--
-- ─── If pg_cron is NOT available (Supabase free tier) ───
-- 1. Deploy an Edge Function that calls:
--      select public.archive_stale_active_events();
--    using the service role client.
-- 2. In Supabase Dashboard → Edge Functions → schedule the function every 15 minutes.
-- 3. Or invoke on a fixed interval from an external cron (GitHub Actions, etc.).
