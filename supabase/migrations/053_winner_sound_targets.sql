-- Winner-reveal sound routing: which surfaces play the celebration audio when the
-- facilitator reveals the overall event winner. Subset of {display, facilitator,
-- players}. NULL = not yet chosen (treated as "all" for safety / legacy events).
alter table public.event_state
  add column if not exists winner_sound_targets text[];

comment on column public.event_state.winner_sound_targets is
  'Surfaces that play the winner-reveal celebration sound: subset of {display, facilitator, players}. NULL = not chosen (treated as all).';

notify pgrst, 'reload schema';
