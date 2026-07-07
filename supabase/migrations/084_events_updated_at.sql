-- Fix: migration 078 added a trigger that writes public.events.updated_at,
-- but the events table (as actually created by 003_games_events_schema.sql)
-- never had that column — every event_games insert/update/delete has been
-- failing with 42703 since 078 landed, which is why attaching games to an
-- event silently failed and the event was left without its games.

alter table public.events
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();
