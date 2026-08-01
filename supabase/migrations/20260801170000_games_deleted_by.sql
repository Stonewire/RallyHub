-- New design, Deleted Games table: a "Deleted By" column. Games already record
-- deleted_at for the 30-day restore window, but never who did it, so the column
-- could not be built.
--
-- ON DELETE SET NULL rather than CASCADE: if the person who deleted a game
-- later leaves the organisation and their account is removed, the game must
-- stay in the bin and stay restorable. Losing the attribution is acceptable;
-- losing the game is not.
alter table public.games
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

comment on column public.games.deleted_by is
  'Who soft-deleted this game. Null for games deleted before this column existed, or when that account has since been removed.';

create index if not exists games_deleted_by_idx
  on public.games (deleted_by)
  where deleted_by is not null;
