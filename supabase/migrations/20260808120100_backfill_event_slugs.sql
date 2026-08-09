-- events.slug is nullable (migration 073) and only auto-populated by the
-- before-insert trigger for NEW rows. Any event created before that trigger
-- existed has slug = null. Backfill using the same next_event_slug()
-- function the trigger itself calls, so the format and collision handling
-- are identical.
-- Use a row-by-row loop (like migration 073) to ensure each row's update
-- is visible to the next row's next_event_slug() call, avoiding collisions
-- when multiple null-slug rows share the same org and name.
do $$
declare r record;
begin
  for r in
    select id, organization_id, name from public.events
    where slug is null order by created_at asc
  loop
    update public.events
    set slug = public.next_event_slug(r.organization_id, r.name, r.id)
    where id = r.id;
  end loop;
end $$;
