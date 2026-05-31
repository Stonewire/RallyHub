-- Bingo win announcement: the team to celebrate now, and which teams were already announced.

alter table public.event_state
  add column if not exists bingo_winner_team_id text;

alter table public.event_state
  add column if not exists bingo_announced_winner_ids jsonb not null default '[]'::jsonb;
