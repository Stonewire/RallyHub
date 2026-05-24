-- Organization logo uploads (fix RLS) + game-assets for live panels

drop policy if exists "Allow org logo uploads" on storage.objects;
create policy "Allow org logo uploads"
on storage.objects for insert
to authenticated
with check (bucket_id = 'organization-logos');

drop policy if exists "Allow org logo updates" on storage.objects;
create policy "Allow org logo updates"
on storage.objects for update
to authenticated
using (bucket_id = 'organization-logos');

drop policy if exists "Allow org logo reads" on storage.objects;
create policy "Allow org logo reads"
on storage.objects for select
to public
using (bucket_id = 'organization-logos');

drop policy if exists "game_assets_public_read" on storage.objects;
create policy "game_assets_public_read"
on storage.objects for select
to public
using (bucket_id = 'game-assets');

drop policy if exists "game_assets_anon_upload" on storage.objects;
create policy "game_assets_anon_upload"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'game-assets');

drop policy if exists "game_assets_anon_update" on storage.objects;
create policy "game_assets_anon_update"
on storage.objects for update
to anon, authenticated
using (bucket_id = 'game-assets');
