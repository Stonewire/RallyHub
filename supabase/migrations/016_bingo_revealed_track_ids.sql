-- Track ids for bingo songs that have been scored and revealed (explicit list, not inferred).

alter table public.event_state
  add column if not exists bingo_revealed_track_ids jsonb not null default '[]'::jsonb;
