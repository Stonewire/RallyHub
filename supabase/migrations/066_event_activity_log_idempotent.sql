-- F9: the event log shows empty because 055 was likely never applied (or only
-- partially). This re-asserts the whole logging setup idempotently so it works
-- regardless of prior state. Safe to run anytime.
create table if not exists public.event_activity_log (
  id              uuid        primary key default gen_random_uuid(),
  event_id        uuid        not null references public.events(id) on delete cascade,
  organization_id uuid        not null references public.organizations(id) on delete cascade,
  actor_type      text        not null check (actor_type in ('team', 'facilitator', 'admin', 'system')),
  actor_name      text,
  actor_id        text,
  action          text        not null,
  details         jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists event_activity_log_event_idx
  on public.event_activity_log(event_id, created_at desc);

alter table public.event_activity_log enable row level security;

drop policy if exists "event_log_select_org" on public.event_activity_log;
create policy "event_log_select_org" on public.event_activity_log
  for select to authenticated
  using (
    organization_id = (select organization_id from public.profiles where id = auth.uid())
    or public.is_super_admin()
  );

create or replace function public.log_event_activity(
  p_event_id   uuid,
  p_actor_type text,
  p_actor_name text,
  p_action     text,
  p_actor_id   text  default null,
  p_details    jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from public.events where id = p_event_id;
  if not found then return; end if;

  insert into public.event_activity_log(
    event_id, organization_id, actor_type, actor_name, actor_id, action, details
  ) values (
    p_event_id, v_org_id, p_actor_type, p_actor_name, p_actor_id, p_action, p_details
  );
end;
$$;

grant execute on function public.log_event_activity to anon, authenticated;

notify pgrst, 'reload schema';
