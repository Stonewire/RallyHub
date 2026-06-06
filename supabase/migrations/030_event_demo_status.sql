-- DEMO event status: free trial live mode (no activation invoice).

alter type public.event_status add value if not exists 'demo';

alter table public.events
  drop constraint if exists events_demo_team_count_check;

alter table public.events
  add constraint events_demo_team_count_check
  check (status <> 'demo' or team_count <= 2);

comment on type public.event_status is
  'Event lifecycle: draft, ready, demo (free trial), active (billed), archived.';

comment on function public.trg_event_activation_billing() is
  'Creates activation invoice on first transition to active only (demo does not bill).';
