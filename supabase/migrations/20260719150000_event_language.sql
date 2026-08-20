-- Phase 1 app translation: the organizer picks one language per event; every
-- live surface (join, display, facilitator, tablet) follows it.

alter table public.events
  add column if not exists language text not null default 'en'
    check (language in ('en', 'bg', 'es', 'fr', 'nl'));

comment on column public.events.language is
  'UI language for all live surfaces of this event. Organizer-authored content is not translated.';
