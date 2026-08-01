# Media capture investigation: revert, diagnose, then fix

Date: 2026-07-30
Branch: `main`
Status: approved for planning

## Why

Six commits landed on `main` today (`39e0b2e` through `ecbb867`, V2.20.1
through V2.20.6) chasing camera/upload bugs one guess at a time, each verified
only in a sandboxed desktop browser. On real hardware, five distinct problems
remain:

1. **iPhone, join screen:** adding a team photo fails with "fail to send a
   request to the edge function." Name/text-only join works.
2. **iPhone, in-game submission:** photo/video challenges show a loading
   screen after Submit, then return to the same screen with nothing sent. No
   loading indicator is shown at all for the submit itself. Text submissions
   do work, but also show no "submitting" animation.
3. **Android tablet, join screen:** adding a team photo opens the OS file
   browser instead of the in-app camera. Whatever photo is added then fails
   with the same "fail to send a request to the edge function" error as
   iPhone.
4. **Android tablet, in-game submission:** the camera opens and preview
   works. Tapping "Take photo" shows a "capturing" state for 4-5 seconds, then
   silently returns to the take-photo screen with nothing captured. Video
   recording has no such delay but is very choppy throughout, and also cannot
   be submitted afterward.
5. **Android text submission works correctly** (closes immediately on
   submit) — the target behavior iPhone should match for text.

Today's guess-and-patch cycle produced regressions and never resolved the
core failure (edge function / upload path failing on both platforms). The
decision going forward: stop patching blind, gather real evidence, then fix
deliberately with a design checked before each change.

## Decision: full revert to V2.20.0

`main` is rolled back to `a4fa36a` (V2.20.0), before any of today's six
commits. This is a **deliberate, explicit tradeoff**, not a clean win:

- Removed (regressions from today, correctly undone): the black-screen
  Android video-record bug, the 15-second-photo live-track-reconfigure bug,
  the x-team-token CORS-preflight bug that broke every submission.
- Reintroduced (the original problems from before today, now back): the hard
  `min` resolution constraint that fails camera open outright on desktop and
  some tablets, and the original ~5 second full-resolution `ImageCapture`
  photo capture path.

No server-side changes (migrations, Edge Functions) were touched by any of
today's six commits — confirmed via diff — so this revert is purely a client
rollback with no data or schema implications.

## Phase 1: diagnostic logging (built before any root cause is known)

A small **permanent** feature, not throwaway scaffolding. Every currently
mysterious failure point gets real, specific error detail — visible on-screen
immediately, and saved server-side for later querying.

### Data model

New table `client_diagnostics`:

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `created_at` | timestamptz | default `now()` |
| `event_id` | uuid, nullable | |
| `team_id` | uuid, nullable | |
| `context` | text | short tag: `join-team-photo`, `submission-upload`, `photo-capture`, `video-record` |
| `platform` | text | quick filter: `ios` / `android` / `desktop` / `other` |
| `message` | text | the real error text (`err.message`) |
| `detail` | jsonb | error name, truncated stack, user agent, and call-site-specific extras (media type, mime, retry count) |

RLS follows the existing anon-write pattern already used for `submissions`:
INSERT gated by a valid join token for the event, no team-token required
(this is not team-scoped or sensitive data). No anon SELECT, and no admin-UI
reader is built in this phase — the table is read directly via SQL (service
role) when diagnosing, not through the app. This reuses established
precedent rather than inventing a new access pattern, deliberately, since
anon-write RLS in this codebase has already caused real incidents (see
`TRACKER.md`'s `P0-2b` and the 076→079 revert history).

### Client-side utility

`src/lib/client-diagnostics.ts` exports one function:

```
reportClientIssue(context: string, error: unknown, extra?: Record<string, unknown>): string
```

- Fire-and-forget REST insert into `client_diagnostics`. REST insert is the
  mechanism already proven reliable today (text submissions go through REST
  and work on both platforms even while edge-function calls fail), so this is
  the right channel to report failures in the *less* reliable paths.
- Never throws, never blocks the caller. Insert failure is swallowed
  silently — losing a diagnostic entry is acceptable; hanging or crashing the
  UI to log a failure is not.
- Returns a short string (e.g. `"NetworkError: Failed to fetch"`) that
  call sites append to their existing `notify()` message, so the real error
  is visible on-screen the moment it happens.

### Call sites (Phase 1 scope — both platforms)

- `mintParticipantUpload` (the edge function invoke) — both the join-team-photo
  path (`JoinEventPage`) and the in-game submission path (`JoinGameView`).
- `uploadToMintedParticipantUrl` (the Storage PUT).
- `captureStillPhoto` failure path in `PhotoChallengeCapture`.
- `MediaRecorder` error paths in `VideoChallengeCapture` (currently only
  surfaces a generic "Could not start recording").
- The catch block in `JoinGameView.submitOpenGame` — the path responsible for
  the iPhone submit-freeze in bug 2 (photo/video half).
- `JoinGameView.submitTextGame` — added after planning found this code is
  byte-for-byte identical on both platforms (fires the insert and closes
  immediately, no platform branch), so an iPhone-only discrepancy here is a
  genuine mystery, not a known gap. See Phase 4 revision below.

### Error handling

Diagnostics must never make a failure worse. The insert is wrapped in
try/catch and never awaited in a way that blocks the user-facing flow. No
retry logic — simplicity over completeness for a diagnostic path.

### Testing

- Unit test `reportClientIssue`: mock the Supabase client, assert the payload
  shape, assert it never throws even when the underlying insert rejects.
- RLS is verified manually, the same way SEC-TEAM was verified (per
  `TRACKER.md`): insert as anon with and without a valid join token via REST,
  confirm accept/reject. This repo has no migration/SQL test framework, so
  manual verification is the established standard here, not a gap being
  introduced now.
- `TRACKER.md` gets an entry once this ships.

## Phase 2: reproduce and gather evidence

With diagnostics live, Rumen reproduces bugs 1-4 on the real iPhone and
Android tablet. Real error names, messages, and context come back from
`client_diagnostics` (and the on-screen message) instead of the generic
"failed to send a request" text seen today.

## Phase 3: root-cause fixes, one at a time

For each root cause the evidence reveals: findings are presented (what the
log shows, what it means), a proposed fix is described, Rumen confirms,
*then* it's implemented and shipped. No batching multiple guessed fixes into
one push, which is what produced today's regressions.

This phase cannot be fully specified yet — the actual fixes are unknown
until Phase 2 produces real evidence. It will very likely need its own
follow-up spec(s) once that evidence exists, per bug or per root cause found.

## Phase 4: known UX gaps — revised, dissolved into Phases 1/3

Originally scoped as two simple, already-understood UX fixes. Reading the
actual code during planning found both premises wrong:

- **"No submitting animation" for photo/video is not a bug.**
  `beginOpenSubmit()` already shows a loading screen the instant Submit is
  tapped, and bug 2's own description confirms it appears ("I have a loading
  screen, and then just go back to the same screen"). What follows is the
  upload throwing — the same root cause as bugs 1/3/4. Fully covered by
  Phase 3; no separate UX task needed.
- **iPhone text-submit not closing like Android is not a known gap.**
  `submitTextGame` is identical code on both platforms: it fires the insert
  and closes immediately without awaiting the response, no platform branch
  anywhere. A platform-specific discrepancy in identical code is a mystery
  like the others, not something to guess-fix. Moved into Phase 1
  (`submitTextGame` added to the diagnostic call sites) and Phase 3 (fixed
  once real evidence exists).

Phase 4 is dissolved — nothing in this spec remains a "just implement it"
UX task. Everything folds into diagnostics (Phase 1) and evidence-driven
fixes (Phase 3).

## Out of scope for this spec

- The actual root-cause fixes for bugs 1, 3, and 4 — deferred to Phase 3,
  spec'd once real evidence exists.
- Any change to server-side Edge Functions or migrations beyond what Phase 1's
  RLS policy requires for the new table.
