-- Add text-based open-stage game type.

do $$
begin
  if exists (select 1 from pg_type where typname = 'game_type') then
    alter type public.game_type add value if not exists 'text';
  end if;
end $$;

alter table public.games drop constraint if exists games_type_check;

alter table public.games
  add constraint games_type_check
  check (type in ('photo', 'video', 'quiz', 'music_bingo', 'text'));
