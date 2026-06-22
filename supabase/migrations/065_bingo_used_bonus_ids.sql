-- #24: each bingo bonus challenge can be triggered only once per run. Track the
-- bonus ids already played so the facilitator buttons disable after one use
-- (cleared when the bingo run is restarted / reset).
alter table public.event_state
  add column if not exists bingo_used_bonus_ids jsonb not null default '[]'::jsonb;
