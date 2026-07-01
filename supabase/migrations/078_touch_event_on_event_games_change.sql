-- P1-2: attaching/removing a game (event_games write) didn't touch the parent
-- event, and event_games isn't in the realtime publication, so live clients
-- never refreshed. Bump events.updated_at on any event_games change so the
-- existing events realtime channel triggers a bundle reload.
-- Applied to production via the connector on 2026-07-01.
create or replace function public.touch_event_on_event_games_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
  set updated_at = now()
  where id = coalesce(new.event_id, old.event_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists event_games_touch_event on public.event_games;
create trigger event_games_touch_event
after insert or update or delete on public.event_games
for each row execute function public.touch_event_on_event_games_change();
