-- Placeholder billing flag per event (wired up fully in a later billing phase).

alter table public.events
  add column if not exists invoice_paid boolean not null default false;
