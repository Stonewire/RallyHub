-- Event UI text color + lock submissions when main event timer ends
alter table public.events
  add column if not exists display_text_color text not null default 'white';

alter table public.events
  drop constraint if exists events_display_text_color_check;

alter table public.events
  add constraint events_display_text_color_check
  check (display_text_color in ('black', 'white'));

alter table public.event_state
  add column if not exists submissions_open boolean not null default true;
