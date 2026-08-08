-- Facilitator control for the event Store: while false, player devices hide
-- Buy Items. Only shown at all when the event has a store configured; an
-- organiser who left the store out of the event never exposes the control to
-- facilitators at all (CF3-15).
alter table public.event_state add column if not exists store_open boolean not null default true;
