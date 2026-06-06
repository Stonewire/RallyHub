-- One-way activation: billed events (invoiced_at set) may only move to archived.

create or replace function public.trg_event_status_lifecycle_guard()
returns trigger
language plpgsql
as $$
begin
  if old.invoiced_at is not null
     and new.status is distinct from old.status
     and new.status <> 'archived' then
    raise exception
      'Event % has been activated and billed. Only archiving is allowed. Duplicate the event to run it again.',
      old.id
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists event_status_lifecycle_guard on public.events;
create trigger event_status_lifecycle_guard
  before update of status on public.events
  for each row
  execute function public.trg_event_status_lifecycle_guard();

comment on function public.trg_event_status_lifecycle_guard() is
  'Prevents reactivation of billed events (invoiced_at set). Only archived is allowed.';
