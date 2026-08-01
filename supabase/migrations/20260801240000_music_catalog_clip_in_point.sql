-- Organiser-marked in point for game clips.
--
-- The music library now plays the full uploaded track rather than the 30s clip,
-- so the organiser can audition a song and mark where its game clip should
-- start. Short clips remain a per-game concern.
--
-- A NEW column rather than reusing clip_start_seconds. That column already
-- means "where the clip we generated actually begins" and, at the time this was
-- written, held 0 for 54 rows and a real auto-chosen offset for 29 others.
-- Reusing it would have silently reinterpreted 83 rows of existing data as
-- deliberate organiser choices. NULL here means unmarked, so clip generation
-- keeps falling back to suggestClipStart exactly as before.
alter table public.music_catalog
  add column if not exists clip_in_point_seconds numeric null;

comment on column public.music_catalog.clip_in_point_seconds is
  'Organiser-marked start for game clips, set while auditioning the full track. NULL means unmarked, so clip generation falls back to suggestClipStart. Deliberately separate from clip_start_seconds, which records where the CURRENT generated clip actually begins and already holds auto-chosen values.';
