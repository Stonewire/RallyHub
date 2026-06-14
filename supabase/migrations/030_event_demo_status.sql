-- DEMO event status: free trial live mode (no activation invoice).
-- Production may use text status (enum dropped) or public.event_status enum.

do $$
begin
  if exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'event_status'
  ) then
    alter type public.event_status add value if not exists 'demo';
    comment on type public.event_status is
      'Event lifecycle: draft, ready, demo (free trial), active (billed), archived.';
  end if;
end $$;

alter table public.events
  drop constraint if exists events_demo_team_count_check;

alter table public.events
  add constraint events_demo_team_count_check
  check (status <> 'demo' or team_count <= 2);

comment on function public.trg_event_activation_billing() is
  'Creates activation invoice on first transition to active only (demo does not bill).';
