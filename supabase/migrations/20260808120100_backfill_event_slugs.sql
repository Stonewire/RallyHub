-- events.slug is nullable (migration 073) and only auto-populated by the
-- before-insert trigger for NEW rows. Any event created before that trigger
-- existed has slug = null. Backfill using the same next_event_slug()
-- function the trigger itself calls, so the format and collision handling
-- are identical.
update public.events e
set slug = public.next_event_slug(e.organization_id, e.name, e.id)
where e.slug is null;
