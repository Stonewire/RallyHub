-- Super admin: manage music catalog for the platform library org (profile org may be null/different)
drop policy if exists "music_catalog_super_admin_all" on public.music_catalog;
create policy "music_catalog_super_admin_all"
on public.music_catalog for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
);

-- Allow org admins to remove catalog audio files from storage when deleting catalog rows
drop policy if exists "game_assets_authenticated_delete" on storage.objects;
create policy "game_assets_authenticated_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'game-assets');
