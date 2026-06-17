-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE — Phase 1 security (C4): game-assets storage lockdown
-- ═══════════════════════════════════════════════════════════════════════════
-- Live upload paths (verified in app code):
--   JoinEventPage / FacilitatorEventPage claim photo:
--     {eventId}/teams/{teamId}/{timestamp}
--   JoinGameView open-game media (photo/video challenges):
--     {eventId}/submissions/{teamId}/{timestamp}
--   JoinGameView bingo bonus proof:
--     {organizationId}/bingo-bonus/{uuid}-{filename}
--
-- Admin/authenticated uploads stay under {organizationId}/... (catalog, bingo
-- audio, game assets via game-upload.ts). Authenticated users may also write
-- live paths above (facilitator claim, logged-in browser with a session).
-- Public read unchanged. Bucket max file size 250MB (matches video upload cap).

update storage.buckets
set file_size_limit = 262144000
where id = 'game-assets';

create or replace function public.storage_path_is_uuid(segment text)
returns boolean
language sql
immutable
as $$
  select segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

-- Participant / live-panel uploads (anon key or authenticated session).
create or replace function public.storage_game_assets_live_upload_path_allowed(object_name text)
returns boolean
language sql
immutable
as $$
  with folders as (
    select storage.foldername(object_name) as parts
  )
  select
    public.storage_path_is_uuid((parts)[1])
    and (
      -- {eventId}/teams/{teamId}/...
      ((parts)[2] = 'teams' and coalesce(array_length(parts, 1), 0) >= 3)
      -- {eventId}/submissions/{teamId}/...
      or ((parts)[2] = 'submissions' and coalesce(array_length(parts, 1), 0) >= 3)
      -- {orgId}/bingo-bonus/...
      or ((parts)[2] = 'bingo-bonus' and coalesce(array_length(parts, 1), 0) >= 2)
    )
  from folders;
$$;

create or replace function public.storage_game_assets_org_path_allowed(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.storage_path_is_uuid((storage.foldername(object_name))[1])
    and (
      (storage.foldername(object_name))[1] = public.user_organization_id()::text
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'super_admin'
      )
    );
$$;

drop policy if exists "game_assets_anon_upload" on storage.objects;
create policy "game_assets_anon_upload"
on storage.objects for insert
to anon
with check (
  bucket_id = 'game-assets'
  and public.storage_game_assets_live_upload_path_allowed(name)
);

drop policy if exists "game_assets_anon_update" on storage.objects;
create policy "game_assets_anon_update"
on storage.objects for update
to anon
using (
  bucket_id = 'game-assets'
  and public.storage_game_assets_live_upload_path_allowed(name)
)
with check (
  bucket_id = 'game-assets'
  and public.storage_game_assets_live_upload_path_allowed(name)
);

drop policy if exists "game_assets_authenticated_insert" on storage.objects;
create policy "game_assets_authenticated_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'game-assets'
  and (
    public.storage_game_assets_org_path_allowed(name)
    or public.storage_game_assets_live_upload_path_allowed(name)
  )
);

drop policy if exists "game_assets_authenticated_update" on storage.objects;
create policy "game_assets_authenticated_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'game-assets'
  and (
    public.storage_game_assets_org_path_allowed(name)
    or public.storage_game_assets_live_upload_path_allowed(name)
  )
)
with check (
  bucket_id = 'game-assets'
  and (
    public.storage_game_assets_org_path_allowed(name)
    or public.storage_game_assets_live_upload_path_allowed(name)
  )
);

drop policy if exists "game_assets_authenticated_delete" on storage.objects;
create policy "game_assets_authenticated_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'game-assets'
  and public.storage_game_assets_org_path_allowed(name)
);

-- Keep public read (media URLs must remain viewable).
drop policy if exists "game_assets_public_read" on storage.objects;
create policy "game_assets_public_read"
on storage.objects for select
to public
using (bucket_id = 'game-assets');

drop function if exists public.storage_game_assets_anon_path_allowed(text);

comment on function public.storage_game_assets_live_upload_path_allowed(text) is
  'Live uploads: {eventId}/teams|submissions/... and {orgId}/bingo-bonus/...';
