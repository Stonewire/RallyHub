-- Music bingo display sync (R2.4).
--
-- The audible clip only ever plays on the facilitator's device. The audience
-- display loads the same clip and analyses a silent second copy to drive its
-- visualizer, but it had nothing to tell it where the room actually was, so it
-- started that copy at 0:00 whenever it noticed bingo_state flip to 'playing'.
-- An anonymous display often misses Realtime and picks the flip up on the 4s
-- event_state poll, and a display opened or reloaded mid-song started from the
-- top while the room was twenty seconds in.
--
-- This column carries the playing track's position plus the wall-clock moment
-- it was measured, so any display can seek its copy to
-- (positionSeconds + time elapsed since atMs) instead of guessing. Written on
-- every discontinuity: start, crossfade into the next song, scrub, pause and
-- resume. The track id is part of the payload because a crossfade starts the
-- next song several seconds before the round advances, so a display must be
-- able to tell an anchor meant for the song it is on from one meant for the
-- next.
--
-- Shape: { "trackId": text, "positionSeconds": number, "atMs": number,
--          "paused": boolean }
--
-- Additive and nullable: clients that do not know about it are unaffected and
-- keep the previous behaviour.

alter table public.event_state
  add column if not exists bingo_track_anchor jsonb;

comment on column public.event_state.bingo_track_anchor is
  'Music bingo playback anchor written by the facilitator: { trackId, positionSeconds, atMs, paused }. Displays seek their silent analyser copy to match so the visualizer follows the sound in the room.';
