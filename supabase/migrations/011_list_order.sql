alter table public.events
  add column if not exists list_order integer not null default 0;

alter table public.games
  add column if not exists list_order integer not null default 0;
