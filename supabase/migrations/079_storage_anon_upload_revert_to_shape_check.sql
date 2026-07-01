-- P0-2 correction: the participant join token is not available to storage RLS
-- (storage-api does not forward it the way PostgREST does; the codebase has no
-- precedent of using it in storage policies). Requiring it on anon uploads
-- would block all participant photo uploads mid-event. Restore anon uploads to
-- the shape-only check. The authenticated ownership tightening from 076 stays.
-- Applied to production via the connector on 2026-07-01.
drop policy if exists "game_assets_anon_upload" on storage.objects;
create policy "game_assets_anon_upload"
on storage.objects for insert to anon
with check (
  bucket_id = 'game-assets'
  and public.storage_game_assets_live_upload_path_allowed(name)
);

drop policy if exists "game_assets_anon_update" on storage.objects;
create policy "game_assets_anon_update"
on storage.objects for update to anon
using (
  bucket_id = 'game-assets'
  and public.storage_game_assets_live_upload_path_allowed(name)
)
with check (
  bucket_id = 'game-assets'
  and public.storage_game_assets_live_upload_path_allowed(name)
);
