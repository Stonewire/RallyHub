-- Separate quiz question countdown from main event timer
alter table public.event_state
  add column if not exists quiz_timer_seconds integer,
  add column if not exists quiz_timer_running boolean not null default false;

-- Human-readable support ticket reference
alter table public.support_tickets
  add column if not exists ticket_number text;

create unique index if not exists support_tickets_ticket_number_key
  on public.support_tickets (ticket_number)
  where ticket_number is not null;
