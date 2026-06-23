-- Music library upgrades:
--  #60 install_music_library(): super-admin copies the platform library's tracks
--      into a client org (skipping ones the org already has).
--  #61 optional genre column + playlists (many-to-many: a song can be in many
--      playlists), for both super-admin and client catalogs.

-- ── #61: optional genre on each track ───────────────────────────────────────
alter table public.music_catalog
  add column if not exists genre text;

-- ── #61: playlists ──────────────────────────────────────────────────────────
create table if not exists public.music_playlists (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  created_at      timestamptz not null default now()
);
create index if not exists music_playlists_org_idx
  on public.music_playlists(organization_id);

create table if not exists public.music_playlist_tracks (
  playlist_id uuid not null references public.music_playlists(id) on delete cascade,
  track_id    uuid not null references public.music_catalog(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (playlist_id, track_id)
);

alter table public.music_playlists enable row level security;
alter table public.music_playlist_tracks enable row level security;

-- Org members manage their own playlists; super_admin manages any.
drop policy if exists music_playlists_org on public.music_playlists;
create policy music_playlists_org on public.music_playlists
  for all to authenticated
  using (
    organization_id = (select organization_id from public.profiles where id = auth.uid())
    or public.is_super_admin()
  )
  with check (
    organization_id = (select organization_id from public.profiles where id = auth.uid())
    or public.is_super_admin()
  );

-- Join rows follow their playlist's org.
drop policy if exists music_playlist_tracks_org on public.music_playlist_tracks;
create policy music_playlist_tracks_org on public.music_playlist_tracks
  for all to authenticated
  using (
    exists (
      select 1 from public.music_playlists pl
      where pl.id = playlist_id
        and (pl.organization_id = (select organization_id from public.profiles where id = auth.uid())
             or public.is_super_admin())
    )
  )
  with check (
    exists (
      select 1 from public.music_playlists pl
      where pl.id = playlist_id
        and (pl.organization_id = (select organization_id from public.profiles where id = auth.uid())
             or public.is_super_admin())
    )
  );

-- ── #60: install the platform music library into a client org ───────────────
create or replace function public.install_music_library(p_target_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_platform uuid;
  v_count    integer := 0;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'super_admin'
  ) then
    raise exception 'Super admin access required';
  end if;

  select id into v_platform
  from public.organizations
  where subdomain = 'rallyhub-library'
  limit 1;
  if v_platform is null then
    raise exception 'Platform library organization not found';
  end if;
  if p_target_org_id = v_platform then
    raise exception 'Cannot install the library into itself';
  end if;

  insert into public.music_catalog (
    organization_id, artist, title, audio_url, clip_url,
    clip_start_seconds, clip_duration_seconds, duration_seconds,
    source_filename, genre
  )
  select p_target_org_id, m.artist, m.title, m.audio_url, m.clip_url,
    m.clip_start_seconds, m.clip_duration_seconds, m.duration_seconds,
    m.source_filename, m.genre
  from public.music_catalog m
  where m.organization_id = v_platform
    and not exists (
      select 1 from public.music_catalog t
      where t.organization_id = p_target_org_id
        and lower(t.title) = lower(m.title)
        and lower(coalesce(t.artist, '')) = lower(coalesce(m.artist, ''))
    );

  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant execute on function public.install_music_library(uuid) to authenticated;

notify pgrst, 'reload schema';
