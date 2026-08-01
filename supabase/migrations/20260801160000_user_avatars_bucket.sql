-- Storage for My Account profile photos.
--
-- A dedicated bucket rather than reusing organization-logos, because the write
-- rule is fundamentally different: logos are written by org admins for the
-- organisation, avatars are written by each user for themselves. Mixing them
-- would mean one policy trying to express both.
--
-- Objects are keyed "<user_id>/<filename>", and every write policy checks that
-- the leading folder equals auth.uid(), so a signed-in user can only ever
-- replace their own avatar.
--
-- image/svg+xml is deliberately EXCLUDED, exactly as it is for the other two
-- public buckets (see 20260715090000_sec_storage_mime_allowlist.sql). An SVG is
-- a script-bearing document, and this bucket is public, so allowing it would
-- reintroduce the same-origin stored-XSS exposure that migration closed. The
-- design's "SVG, PNG or JPG" copy is corrected in the UI instead.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-avatars',
  'user-avatars',
  true,
  2097152, -- 2MB, matching the limit the UI states
  array['image/jpeg','image/pjpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public bucket, so anyone may read. Avatars are shown in the admin shell and
-- there is nothing secret in them.
drop policy if exists "user_avatars_public_read" on storage.objects;
create policy "user_avatars_public_read" on storage.objects
  for select
  using (bucket_id = 'user-avatars');

-- Write, replace and remove are restricted to the owner's own folder.
drop policy if exists "user_avatars_insert_own" on storage.objects;
create policy "user_avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "user_avatars_update_own" on storage.objects;
create policy "user_avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "user_avatars_delete_own" on storage.objects;
create policy "user_avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
