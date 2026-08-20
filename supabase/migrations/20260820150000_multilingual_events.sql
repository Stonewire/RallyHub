-- Multilingual events: one event, several player languages.
--
-- The organiser turns this on per event and picks which languages are offered.
-- Each team then chooses its own language as the very first thing it does on
-- joining, before the privacy notice, so the consent text is read in that
-- language too. The event's own `language` column stays the base: it drives the
-- display screen, the facilitator panel, and any team that has not chosen.

alter table public.events
  add column if not exists multilingual boolean not null default false;

comment on column public.events.multilingual is
  'When true, joining teams pick their own language from available_languages. The display and facilitator panel still follow events.language.';

alter table public.events
  add column if not exists available_languages text[] not null default '{}';

comment on column public.events.available_languages is
  'Languages offered to teams when multilingual is on. Empty means fall back to events.language alone.';

-- Every entry must be a language the app actually ships.
alter table public.events
  drop constraint if exists events_available_languages_check;
alter table public.events
  add constraint events_available_languages_check
  check (available_languages <@ array['en','bg','es','fr','nl']::text[]);

alter table public.teams
  add column if not exists language text;

comment on column public.teams.language is
  'The language this team picked at join on a multilingual event. Null means follow the event language.';

alter table public.teams
  drop constraint if exists teams_language_check;
alter table public.teams
  add constraint teams_language_check
  check (language is null or language in ('en','bg','es','fr','nl'));

-- Participants are anonymous and write their own team row through the join
-- flow, so the existing team-update policy already covers this column. Nothing
-- new is granted here; the column simply rides along.

notify pgrst, 'reload schema';
