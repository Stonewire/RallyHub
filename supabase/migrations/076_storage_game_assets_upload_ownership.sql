-- P0-2: game-assets live uploads must be owned by the caller, not merely
-- path-shaped. Anon must hold the join token for the event (or org, for
-- bingo-bonus); authenticated must be facilitator/org-staff for the event
-- (or own the org prefix). CASE-guarded so non-uuid names never hit a cast.
-- Applied to production via the Supabase connector on 2026-07-01.
create or replace function public.storage_game_assets_live_upload_owned(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with f as (select storage.foldername(object_name) as parts)
  select case
    when not public.storage_path_is_uuid((parts)[1]) then false
    when (parts)[2] in ('teams','submissions') and coalesce(array_length(parts,1),0) >= 3 then
      public.live_join_token_matches_event((parts)[1]::uuid)
      or public.is_facilitator_for_event((parts)[1]::uuid)
      or public.is_org_staff_for_event((parts)[1]::uuid)
    when (parts)[2] = 'bingo-bonus' and coalesce(array_length(parts,1),0) >= 2 then
      exists (
        select 1 from public.events e
        where e.join_token = public.current_live_join_token()
          and e.organization_id = (parts)[1]::uuid
      )
      or (parts)[1] = public.user_organization_id()::text
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
    else false
  end
  from f;
$$;

drop policy if exists "game_assets_anon_upload" on storage.objects;
create policy "game_assets_anon_upload"
on storage.objects for insert to anon
with check (bucket_id = 'game-assets' and public.storage_game_assets_live_upload_owned(name));

drop policy if exists "game_assets_anon_update" on storage.objects;
create policy "game_assets_anon_update"
on storage.objects for update to anon
using (bucket_id = 'game-assets' and public.storage_game_assets_live_upload_owned(name))
with check (bucket_id = 'game-assets' and public.storage_game_assets_live_upload_owned(name));

drop policy if exists "game_assets_authenticated_insert" on storage.objects;
create policy "game_assets_authenticated_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'game-assets'
  and (public.storage_game_assets_org_path_allowed(name) or public.storage_game_assets_live_upload_owned(name))
);

drop policy if exists "game_assets_authenticated_update" on storage.objects;
create policy "game_assets_authenticated_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'game-assets'
  and (public.storage_game_assets_org_path_allowed(name) or public.storage_game_assets_live_upload_owned(name))
)
with check (
  bucket_id = 'game-assets'
  and (public.storage_game_assets_org_path_allowed(name) or public.storage_game_assets_live_upload_owned(name))
);

comment on function public.storage_game_assets_live_upload_owned(text) is
  'Live game-assets uploads scoped to the caller: anon via join token, authenticated via facilitator/org-staff or own org prefix.';
