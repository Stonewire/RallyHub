-- New design, event editor and event cards: events carry a human-readable
-- location ("Valletta, MT", "Remote"). Free text on purpose. It is display-only
-- for organisers and facilitators, never parsed or geocoded, so there is no
-- value in constraining it to a place list.
alter table public.events
  add column if not exists location text;

comment on column public.events.location is
  'Optional free-text event location shown on event cards and in the editor. Display only.';
