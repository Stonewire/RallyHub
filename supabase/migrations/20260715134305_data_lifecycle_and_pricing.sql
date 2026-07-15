-- Approved pricing + Storage-first data lifecycle.
--
-- Permanent deletion is deliberately split in two:
--   1. Postgres queues/claims work but keeps the source rows intact.
--   2. The data-lifecycle Edge Function removes Storage objects through the
--      Storage API, then calls the service-only finalizer below.
-- This prevents the old failure mode where DB rows disappeared while their
-- photos/videos remained billable forever in Storage.

-- ── Pricing ───────────────────────────────────────────────────────────────

create or replace function public.plan_per_event_price_eur(p_plan text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case lower(coalesce(trim(p_plan), 'rookie'))
    when 'rookie' then 199 when 'free' then 199
    when 'arena' then 149 when 'starter' then 149
    when 'pro' then 99
    when 'max' then 95
    when 'enterprise' then 0
    when 'partner' then 0
    else 199
  end
$$;

comment on function public.plan_per_event_price_eur(text) is
  'Per-event EUR fee: Free 199, Starter 149, Pro 99, Business 95, comped plans 0.';

-- ── Client account-deletion requests ─────────────────────────────────────

create table if not exists public.organization_deletion_requests (
  organization_id uuid primary key
    references public.organizations(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null,
  paddle_cancellation_scheduled boolean not null default false,
  paddle_cancellation_error text,
  constraint organization_deletion_minimum_window
    check (scheduled_for >= requested_at + interval '30 days')
);

create index if not exists organization_deletion_requests_scheduled_for_idx
  on public.organization_deletion_requests (scheduled_for);

create index if not exists organization_deletion_requests_requested_by_idx
  on public.organization_deletion_requests (requested_by);

alter table public.organization_deletion_requests enable row level security;

drop policy if exists organization_deletion_requests_select on public.organization_deletion_requests;
create policy organization_deletion_requests_select
on public.organization_deletion_requests
for select
to authenticated
using (
  (select public.is_super_admin())
  or organization_id = (select public.user_organization_id())
);

revoke all on table public.organization_deletion_requests from public, anon, authenticated;
grant select on table public.organization_deletion_requests to authenticated;
grant select, insert, update, delete
  on table public.organization_deletion_requests to service_role;

comment on table public.organization_deletion_requests is
  'A reversible 30-day client account-deletion request. Only the lifecycle Edge Function may write it.';

-- ── Private retry queue ───────────────────────────────────────────────────

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.data_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('event', 'organization')),
  target_id uuid not null,
  reason text not null check (reason in ('event_bin', 'event_retention', 'account_request')),
  available_at timestamptz not null,
  claimed_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_type, target_id)
);

create index if not exists data_cleanup_jobs_available_idx
  on private.data_cleanup_jobs (available_at, created_at)
  where claimed_at is null;

revoke all on table private.data_cleanup_jobs from public, anon, authenticated;

create or replace function private.queue_data_cleanup(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_available_at timestamptz
)
returns void
language plpgsql
set search_path = private, public
as $$
begin
  insert into private.data_cleanup_jobs (
    target_type,
    target_id,
    reason,
    available_at
  ) values (
    p_target_type,
    p_target_id,
    p_reason,
    p_available_at
  )
  on conflict (target_type, target_id) do update
  set
    reason = case
      when excluded.available_at < data_cleanup_jobs.available_at then excluded.reason
      else data_cleanup_jobs.reason
    end,
    available_at = least(data_cleanup_jobs.available_at, excluded.available_at),
    updated_at = now();
end;
$$;

revoke all on function private.queue_data_cleanup(text, uuid, text, timestamptz)
  from public, anon, authenticated;

-- Keep the queue aligned with the event Bin. Restoring an event removes only
-- a Bin job; a separate six-month retention job must remain eligible.
create or replace function public.trg_queue_event_storage_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.deleted_at is not null
     and old.deleted_at is distinct from new.deleted_at then
    perform private.queue_data_cleanup(
      'event',
      new.id,
      'event_bin',
      new.deleted_at + interval '30 days'
    );
  elsif new.deleted_at is null and old.deleted_at is not null then
    delete from private.data_cleanup_jobs
    where target_type = 'event'
      and target_id = new.id
      and reason = 'event_bin'
      and claimed_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists events_queue_storage_cleanup on public.events;
create trigger events_queue_storage_cleanup
after update of deleted_at on public.events
for each row execute function public.trg_queue_event_storage_cleanup();

revoke all on function public.trg_queue_event_storage_cleanup()
  from public, anon, authenticated;

-- Queue/cancel organization cleanup whenever the service-owned request changes.
create or replace function public.trg_queue_organization_storage_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if tg_op = 'DELETE' then
    delete from private.data_cleanup_jobs
    where target_type = 'organization'
      and target_id = old.organization_id
      and reason = 'account_request'
      and claimed_at is null;
    return old;
  end if;

  perform private.queue_data_cleanup(
    'organization',
    new.organization_id,
    'account_request',
    new.scheduled_for
  );
  return new;
end;
$$;

drop trigger if exists organization_deletion_queue_cleanup
  on public.organization_deletion_requests;
create trigger organization_deletion_queue_cleanup
after insert or update of scheduled_for on public.organization_deletion_requests
for each row execute function public.trg_queue_organization_storage_cleanup();

drop trigger if exists organization_deletion_cancel_cleanup
  on public.organization_deletion_requests;
create trigger organization_deletion_cancel_cleanup
after delete on public.organization_deletion_requests
for each row execute function public.trg_queue_organization_storage_cleanup();

revoke all on function public.trg_queue_organization_storage_cleanup()
  from public, anon, authenticated;

-- ── Existing DB-only purges now enqueue Storage-first jobs ────────────────

create or replace function public.purge_deleted_events()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_count integer;
begin
  with due as (
    select e.id, e.deleted_at + interval '30 days' as available_at
    from public.events e
    where e.deleted_at is not null
      and e.deleted_at < now() - interval '30 days'
      and e.wiped_at is null
  ), queued as (
    insert into private.data_cleanup_jobs (
      target_type,
      target_id,
      reason,
      available_at
    )
    select 'event', id, 'event_bin', available_at
    from due
    on conflict (target_type, target_id) do nothing
    returning id
  )
  select count(*) into v_count from queued;

  return v_count;
end;
$$;

revoke all on function public.purge_deleted_events()
  from public, anon, authenticated;

comment on function public.purge_deleted_events() is
  'Queues events whose 30-day Bin window expired; the Edge worker deletes Storage before DB data.';

create or replace function public.purge_old_event_data()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_count integer;
begin
  with due as (
    select e.id
    from public.events e
    where e.invoiced_at is not null
      and e.invoiced_at < now() - interval '6 months'
      and e.wiped_at is null
  ), queued as (
    insert into private.data_cleanup_jobs (
      target_type,
      target_id,
      reason,
      available_at
    )
    select 'event', id, 'event_retention', now()
    from due
    on conflict (target_type, target_id) do nothing
    returning id
  )
  select count(*) into v_count from queued;

  return v_count;
end;
$$;

revoke all on function public.purge_old_event_data()
  from public, anon, authenticated;

comment on function public.purge_old_event_data() is
  'Queues six-month event retention cleanup; the Edge worker deletes Storage before DB data.';

-- Backfill jobs that were already due before this migration landed.
select public.purge_deleted_events();
select public.purge_old_event_data();

-- Older versions marked invoiced events wiped after deleting only their DB
-- children. Their event row still gives us the safe Storage prefix, so enqueue
-- a one-time cleanup for those known historical orphans as well.
insert into private.data_cleanup_jobs (
  target_type,
  target_id,
  reason,
  available_at
)
select 'event', e.id, 'event_retention', now()
from public.events e
where e.wiped_at is not null
on conflict (target_type, target_id) do nothing;

-- ── Service-only worker RPCs ──────────────────────────────────────────────

create or replace function public.claim_data_cleanup_jobs(p_limit integer default 10)
returns table (
  job_id uuid,
  target_type text,
  target_id uuid,
  reason text
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  return query
  with candidates as (
    select j.id
    from private.data_cleanup_jobs j
    where j.available_at <= now()
      and (
        j.claimed_at is null
        or j.claimed_at < now() - interval '30 minutes'
      )
    order by j.available_at, j.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ), claimed as (
    update private.data_cleanup_jobs j
    set
      claimed_at = now(),
      attempts = j.attempts + 1,
      last_error = null,
      updated_at = now()
    from candidates c
    where j.id = c.id
    returning j.id, j.target_type, j.target_id, j.reason
  )
  select c.id, c.target_type, c.target_id, c.reason
  from claimed c;
end;
$$;

revoke all on function public.claim_data_cleanup_jobs(integer)
  from public, anon, authenticated;
grant execute on function public.claim_data_cleanup_jobs(integer) to service_role;

create or replace function public.fail_data_cleanup_job(
  p_job_id uuid,
  p_error text
)
returns void
language sql
security definer
set search_path = public, private
as $$
  update private.data_cleanup_jobs
  set
    claimed_at = null,
    last_error = left(coalesce(p_error, 'Unknown cleanup error'), 2000),
    updated_at = now()
  where id = p_job_id
$$;

revoke all on function public.fail_data_cleanup_job(uuid, text)
  from public, anon, authenticated;
grant execute on function public.fail_data_cleanup_job(uuid, text) to service_role;

create or replace function public.complete_data_cleanup_job(p_job_id uuid)
returns void
language sql
security definer
set search_path = public, private
as $$
  delete from private.data_cleanup_jobs where id = p_job_id
$$;

revoke all on function public.complete_data_cleanup_job(uuid)
  from public, anon, authenticated;
grant execute on function public.complete_data_cleanup_job(uuid) to service_role;

create or replace function public.finalize_event_data_cleanup(
  p_event_id uuid,
  p_job_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_reason text;
begin
  perform 1
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    if p_job_id is not null then
      delete from private.data_cleanup_jobs where id = p_job_id;
    end if;
    return;
  end if;

  if p_job_id is not null then
    select j.reason
    into v_reason
    from private.data_cleanup_jobs j
    where j.id = p_job_id
      and j.target_type = 'event'
      and j.target_id = p_event_id;

    if not found then
      raise exception 'Cleanup job % does not match event %', p_job_id, p_event_id;
    end if;
  end if;

  delete from public.event_activity_log where event_id = p_event_id;
  delete from public.chat_messages       where event_id = p_event_id;
  delete from public.submissions         where event_id = p_event_id;
  delete from public.bingo_team_cards
    where run_id in (select id from public.bingo_runs where event_id = p_event_id);
  delete from public.bingo_runs  where event_id = p_event_id;
  delete from public.teams       where event_id = p_event_id;
  delete from public.event_state where event_id = p_event_id;
  delete from public.event_games where event_id = p_event_id;

  -- Six-month retention removes participant data and media but deliberately
  -- keeps the minimal invoiced event shell for billing history. Manual
  -- permanent deletion and 30-day Bin expiry remove the event row itself.
  if v_reason = 'event_retention' then
    update public.events
    set wiped_at = now()
    where id = p_event_id;
  else
    delete from public.events where id = p_event_id;
  end if;

  if p_job_id is not null then
    delete from private.data_cleanup_jobs where id = p_job_id;
  else
    delete from private.data_cleanup_jobs
    where target_type = 'event' and target_id = p_event_id;
  end if;
end;
$$;

revoke all on function public.finalize_event_data_cleanup(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_event_data_cleanup(uuid, uuid) to service_role;

-- The old browser-callable deletion RPC bypasses Storage. All client deletion
-- now goes through the data-lifecycle Edge Function.
drop function if exists public.delete_organization_cascade(uuid);
revoke all on function public.wipe_event_data(uuid) from public, anon, authenticated;
grant execute on function public.wipe_event_data(uuid) to service_role;

-- ── Daily Edge worker schedule ────────────────────────────────────────────
-- The two Vault secrets are configured once per environment:
--   project_url                 = https://<project-ref>.supabase.co
--   data_lifecycle_cron_secret = a long random value also set on the function

create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule('data-lifecycle-worker');
exception when others then
  null;
end;
$$;

select cron.schedule(
  'data-lifecycle-worker',
  '15 3 * * *',
  $command$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'project_url'
        limit 1
      ) || '/functions/v1/data-lifecycle',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-data-lifecycle-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'data_lifecycle_cron_secret'
          limit 1
        )
      ),
      body := '{"action":"run_scheduled_cleanup"}'::jsonb
    );
  $command$
);
