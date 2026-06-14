-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE — Phase 1 security (C4): game-assets storage lockdown
-- ═══════════════════════════════════════════════════════════════════════════
-- Anon live uploads: {eventId}/teams|submissions/... and {orgId}/bingo-bonus/...
-- Authenticated uploads: paths under own organization_id/...
-- Public read unchanged. Bucket max file size 250MB (matches video upload cap).

update storage.buckets
set file_size_limit = 262144000
where id = 'game-assets';

-- UUID v4 path prefix helper for live anon uploads.
create or replace function public.storage_game_assets_anon_path_allowed(object_name text)
returns boolean
language sql
immutable
as $$
  select object_name ~ (
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/(teams|submissions|bingo-bonus)/'
  );
$$;

create or replace function public.storage_game_assets_org_path_allowed(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (storage.foldername(object_name))[1] = public.user_organization_id()::text
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    );
$$;

drop policy if exists "game_assets_anon_upload" on storage.objects;
create policy "game_assets_anon_upload"
on storage.objects for insert
to anon
with check (
  bucket_id = 'game-assets'
  and public.storage_game_assets_anon_path_allowed(name)
);

drop policy if exists "game_assets_anon_update" on storage.objects;
create policy "game_assets_anon_update"
on storage.objects for update
to anon
using (
  bucket_id = 'game-assets'
  and public.storage_game_assets_anon_path_allowed(name)
)
with check (
  bucket_id = 'game-assets'
  and public.storage_game_assets_anon_path_allowed(name)
);

drop policy if exists "game_assets_authenticated_insert" on storage.objects;
create policy "game_assets_authenticated_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'game-assets'
  and public.storage_game_assets_org_path_allowed(name)
);

drop policy if exists "game_assets_authenticated_update" on storage.objects;
create policy "game_assets_authenticated_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'game-assets'
  and public.storage_game_assets_org_path_allowed(name)
)
with check (
  bucket_id = 'game-assets'
  and public.storage_game_assets_org_path_allowed(name)
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

comment on function public.storage_game_assets_anon_path_allowed(text) is
  'Live anon uploads: event teams/submissions folders and org bingo-bonus proofs only.';
