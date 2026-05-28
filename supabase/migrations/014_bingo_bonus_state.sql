-- Active music-bingo bonus challenge (facilitator-launched)

alter table public.event_state
  add column if not exists bingo_bonus_id text;
