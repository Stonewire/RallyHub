-- New design, Deleted Games table: a "Deleted By" column. Games already record
-- deleted_at for the 30-day restore window, but never who did it, so the column
-- could not be built.
--
-- ON DELETE SET NULL rather than CASCADE: if the person who deleted a game
-- later leaves the organisation and their account is removed, the game must
-- stay in the bin and stay restorable. Losing the game would be far worse than
-- losing the attribution.
--
-- But losing the attribution outright is still bad: the bin would just go blank
-- in that column with no explanation. So the display name is ALSO snapshotted
-- at deletion time in deleted_by_name. That survives the account being removed,
-- letting the UI say "Sarah Jenks (account removed)" instead of nothing.
--
-- The two columns answer different questions on purpose:
--   deleted_by      -> the live link, for joining to the current profile
--   deleted_by_name -> what to show when that link is gone
-- Rows deleted before this migration have neither, and render as "Unknown",
-- which is honest: we genuinely do not know who deleted them.
alter table public.games
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_by_name text;

comment on column public.games.deleted_by is
  'Who soft-deleted this game. Null for games binned before this column existed, or when that account has since been removed. Use deleted_by_name for display in that case.';
comment on column public.games.deleted_by_name is
  'Display name captured at deletion time, so attribution survives the account being deleted.';

create index if not exists games_deleted_by_idx
  on public.games (deleted_by)
  where deleted_by is not null;
