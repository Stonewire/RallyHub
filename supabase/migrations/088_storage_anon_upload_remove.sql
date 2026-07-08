-- P0-2b: anon direct-write access to game-assets is no longer needed by the
-- app. Both participant upload call sites (quest submissions, team claim
-- photo) now go through the mint-storage-upload-url edge function, which
-- verifies the join token against the specific event (a normal request,
-- headers ARE visible there) and mints a signed upload URL — Supabase's
-- signed-upload flow needs zero RLS grant on storage.objects.
--
-- Unlike the 076 -> 079 revert (which tried to make anon RLS itself
-- token-aware and broke live uploads because storage-api doesn't forward
-- the join-token header), this just removes the anon write path entirely.
-- Nothing in the app calls storage.from(...).upload() directly anymore
-- (confirmed via grep) — only src/lib/storage.ts, which now routes
-- participant uploads through the signed-URL flow.
drop policy if exists "game_assets_anon_upload" on storage.objects;
drop policy if exists "game_assets_anon_update" on storage.objects;
